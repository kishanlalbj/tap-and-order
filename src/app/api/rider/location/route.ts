import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { toPoint } from "@/lib/geo";
import { publish } from "@/lib/realtime";
import { getRiderForUser } from "@/server/authz";
import { markRiderAvailable } from "@/server/domain/riders";

const body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Rider app pings its position here every few seconds. */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "rider") return new Response("Unauthorized", { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const loc = parsed.data;

  const rider = await getRiderForUser(session.user.id);
  if (!rider || rider.approval !== "APPROVED") return new Response("Forbidden", { status: 403 });

  await db
    .update(schema.riders)
    .set({ lastLocation: toPoint(loc), lastSeenAt: new Date() })
    .where(eq(schema.riders.id, rider.id));

  if (rider.status === "ONLINE") {
    await markRiderAvailable(rider.id, loc);
  } else if (rider.status === "BUSY") {
    const [active] = await db
      .select({ orderId: schema.deliveries.orderId })
      .from(schema.deliveries)
      .where(
        and(
          eq(schema.deliveries.riderId, rider.id),
          inArray(schema.deliveries.status, ["ASSIGNED", "PICKING", "OUT_FOR_DELIVERY"]),
        ),
      );
    if (active) await publish(`order:${active.orderId}`, { type: "rider.location", ...loc });
  }
  return Response.json({ ok: true });
}
