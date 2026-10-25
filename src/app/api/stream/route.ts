import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { createSubscriber } from "@/lib/redis";
import { getRiderForUser, getSellerForUser } from "@/server/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function canSubscribe(user: { id: string; role: string }, channel: string): Promise<boolean> {
  const [kind, id] = channel.split(":");
  if (user.role === "admin") return true;
  switch (kind) {
    case "order": {
      if (!id) return false;
      const [order] = await db
        .select({ customerId: schema.orders.customerId })
        .from(schema.orders)
        .where(eq(schema.orders.id, id));
      if (order?.customerId === user.id) return true;
      if (user.role === "rider") {
        const rider = await getRiderForUser(user.id);
        if (!rider) return false;
        const [d] = await db
          .select({ id: schema.deliveries.id })
          .from(schema.deliveries)
          .where(and(eq(schema.deliveries.orderId, id), eq(schema.deliveries.riderId, rider.id)));
        return !!d;
      }
      return false;
    }
    case "seller":
      return user.role === "seller" && (await getSellerForUser(user.id))?.id === id;
    case "rider":
      return user.role === "rider" && (await getRiderForUser(user.id))?.id === id;
    default:
      return false;
  }
}

/** Server-Sent Events relay: browser <- this route <- Redis pub/sub channel `rt:<channel>`. */
export async function GET(req: Request) {
  const session = await auth();
  const channel = new URL(req.url).searchParams.get("channel");
  if (!session?.user || !channel) return new Response("Unauthorized", { status: 401 });
  if (!(await canSubscribe(session.user, channel))) return new Response("Forbidden", { status: 403 });

  const sub = createSubscriber();
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    clearInterval(heartbeat);
    sub.disconnect();
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      sub.on("message", (_ch, message) => send(`data: ${message}\n\n`));
      await sub.subscribe(`rt:${channel}`);
      send(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
    },
    cancel: close,
  });

  req.signal.addEventListener("abort", close);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
