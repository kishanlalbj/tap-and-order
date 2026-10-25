"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { toPoint } from "@/lib/geo";
import { enqueue } from "@/lib/queue";
import { assertApprovedRider } from "@/server/authz";
import { attempt } from "@/server/action-result";
import { completeDelivery, DomainError, pickUpSellerOrder } from "@/server/domain/orders";
import { markRiderAvailable, markRiderUnavailable } from "@/server/domain/riders";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export async function goOnline(loc: { lat: number; lng: number }) {
  const res = await attempt(async () => {
    const { rider } = await assertApprovedRider();
    const point = latLng.parse(loc);
    const [updated] = await db
      .update(schema.riders)
      .set({ status: "ONLINE", lastLocation: toPoint(point), lastSeenAt: new Date() })
      .where(and(eq(schema.riders.id, rider.id), eq(schema.riders.status, "OFFLINE")))
      .returning();
    if (!updated) return;
    await markRiderAvailable(rider.id, point);

    // Orders that were waiting for any rider get another dispatch attempt right away.
    const waiting = await db
      .select({ orderId: schema.deliveries.orderId })
      .from(schema.deliveries)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.deliveries.orderId))
      .where(and(eq(schema.deliveries.status, "SEARCHING"), inArray(schema.orders.status, ["CONFIRMED", "PACKED"])));
    for (const w of waiting) {
      await enqueue("dispatch", { orderId: w.orderId }, { jobId: `dispatch-${w.orderId}-${Date.now()}` });
    }
    revalidatePath("/rider");
  });
  return { error: res?.error };
}

export async function goOffline() {
  const res = await attempt(async () => {
    const { rider } = await assertApprovedRider();
    if (rider.status === "BUSY") throw new DomainError("Finish your current delivery before going offline.");
    await db.update(schema.riders).set({ status: "OFFLINE" }).where(eq(schema.riders.id, rider.id));
    await markRiderUnavailable(rider.id);
    revalidatePath("/rider");
  });
  return { error: res?.error };
}

export async function markPickedUp(sellerOrderId: string) {
  const res = await attempt(async () => {
    const { rider } = await assertApprovedRider();
    await pickUpSellerOrder(rider.id, sellerOrderId);
    revalidatePath("/rider");
  });
  return { error: res?.error };
}

export async function markDelivered(deliveryId: string) {
  const res = await attempt(async () => {
    const { rider } = await assertApprovedRider();
    await completeDelivery(rider.id, deliveryId);
    revalidatePath("/rider");
  });
  return { error: res?.error };
}
