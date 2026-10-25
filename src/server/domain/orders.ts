import { and, eq, notInArray, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import type { Role } from "@/db/schema";
import { fromPoint } from "@/lib/geo";
import { enqueue, jobIds, removeJob } from "@/lib/queue";
import { publish } from "@/lib/realtime";
import { distanceFrom, offerAvailableAt } from "./availability";
import { markRiderAvailable } from "./riders";

const { orders, sellerOrders, orderItems, offers, deliveries, riders, orderEvents } = schema;

/** An error whose message is safe to show to the user. */
export class DomainError extends Error {}

const INACTIVE_SELLER_ORDER = ["REJECTED", "CANCELLED"] as const;

export const acceptTimeoutMs = () => Number(process.env.SELLER_ACCEPT_TIMEOUT_S ?? 120) * 1000;

export async function logEvent(
  tx: Tx,
  orderId: string,
  actor: Role | null,
  message: string,
  payload?: Record<string, unknown>,
) {
  await tx.insert(orderEvents).values({ orderId, actor, message, payload });
}

/**
 * Derives the customer-facing order status (and payment status) from its seller orders and
 * delivery. Every state change goes through here so the rules live in one place.
 */
export async function recomputeOrder(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  const sos = await tx
    .select({ status: sellerOrders.status })
    .from(sellerOrders)
    .where(eq(sellerOrders.orderId, orderId));
  const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.orderId, orderId));

  const active = sos.filter((s) => !INACTIVE_SELLER_ORDER.includes(s.status as never));
  let status: typeof order.status;
  if (active.length === 0) status = "CANCELLED";
  else if (delivery?.status === "DELIVERED") status = "DELIVERED";
  else if (delivery?.status === "OUT_FOR_DELIVERY") status = "OUT_FOR_DELIVERY";
  else if (active.every((s) => s.status === "PACKED" || s.status === "PICKED_UP")) status = "PACKED";
  else if (active.every((s) => s.status !== "PENDING")) status = "CONFIRMED";
  else status = "PLACED";

  const refundedPaise = status === "CANCELLED" ? order.totalPaise : order.refundedPaise;
  const paymentStatus =
    refundedPaise === 0 ? "PAID" : refundedPaise >= order.totalPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const changed = status !== order.status;
  if (changed || refundedPaise !== order.refundedPaise || paymentStatus !== order.paymentStatus) {
    await tx
      .update(orders)
      .set({
        status,
        refundedPaise,
        paymentStatus,
        deliveredAt: status === "DELIVERED" ? new Date() : order.deliveredAt,
      })
      .where(eq(orders.id, orderId));
  }
  if (changed) await logEvent(tx, orderId, null, STATUS_MESSAGES[status], { status });

  let releasedRider: { id: string; lat: number; lng: number } | null = null;
  if (status === "CANCELLED" && delivery && delivery.status !== "CANCELLED") {
    await tx.update(deliveries).set({ status: "CANCELLED" }).where(eq(deliveries.id, delivery.id));
    if (delivery.riderId) releasedRider = await releaseRider(tx, delivery.riderId);
  }

  return { orderId, prevStatus: order.status, status, changed, deliveryStatus: delivery?.status, releasedRider };
}

export const STATUS_MESSAGES: Record<(typeof schema.orderStatusEnum.enumValues)[number], string> = {
  PLACED: "Order placed — waiting for stores to accept",
  CONFIRMED: "All stores confirmed your order",
  PACKED: "Your items are packed",
  OUT_FOR_DELIVERY: "Rider is on the way to you",
  DELIVERED: "Order delivered",
  CANCELLED: "Order cancelled and refunded",
};

async function releaseRider(tx: Tx, riderId: string) {
  const [rider] = await tx
    .update(riders)
    .set({ status: "ONLINE" })
    .where(and(eq(riders.id, riderId), eq(riders.status, "BUSY")))
    .returning();
  return rider?.lastLocation ? { id: rider.id, ...fromPoint(rider.lastLocation) } : null;
}

type Recomputed = Awaited<ReturnType<typeof recomputeOrder>>;

/** Side effects after a committed change: realtime fan-out, dispatch, notifications. */
async function afterChange(r: Recomputed) {
  if (r.releasedRider) await markRiderAvailable(r.releasedRider.id, r.releasedRider);

  const needsRider =
    (r.status === "CONFIRMED" || r.status === "PACKED") && r.deliveryStatus === "SEARCHING";
  if (needsRider) {
    await enqueue("dispatch", { orderId: r.orderId }, { jobId: jobIds.dispatch(r.orderId), ...DISPATCH_RETRY });
  }
  if (r.changed) {
    const [order] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, r.orderId));
    await enqueue("notifications", { to: order.customerId, channel: "push", message: STATUS_MESSAGES[r.status] });
  }
  await broadcastOrder(r.orderId, r.status);
}

export const DISPATCH_RETRY = {
  attempts: 40,
  backoff: { type: "fixed", delay: 15_000 },
  removeOnFail: true,
} as const;

/** Tells everyone looking at this order (customer, its sellers, its rider, admins) to refresh. */
export async function broadcastOrder(orderId: string, status?: string) {
  const sos = await db
    .select({ id: sellerOrders.id, sellerId: sellerOrders.sellerId, status: sellerOrders.status })
    .from(sellerOrders)
    .where(eq(sellerOrders.orderId, orderId));
  const [delivery] = await db
    .select({ riderId: deliveries.riderId })
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId));

  await publish([`order:${orderId}`, "admin"], { type: "order.updated", orderId, status });
  for (const so of sos) {
    await publish(`seller:${so.sellerId}`, {
      type: "seller.order",
      sellerOrderId: so.id,
      orderId,
      status: so.status,
    });
  }
  if (delivery?.riderId) await publish(`rider:${delivery.riderId}`, { type: "refresh" });
}

/** Re-totals a seller order from its active items. */
async function retotalSellerOrder(tx: Tx, sellerOrderId: string) {
  await tx.execute(sql`
    update seller_orders so set
      subtotal_paise = t.subtotal,
      commission_paise = round(t.subtotal * s.commission_bps / 10000.0)::int,
      updated_at = now()
    from (
      select coalesce(sum(qty * unit_price_paise), 0)::int as subtotal
      from order_items where seller_order_id = ${sellerOrderId} and status = 'ACTIVE'
    ) t, sellers s
    where so.id = ${sellerOrderId} and s.id = so.seller_id
  `);
}

// ---------------------------------------------------------------------------
// Seller transitions
// ---------------------------------------------------------------------------

async function transitionSellerOrder(
  seller: { id: string; storeName: string },
  sellerOrderId: string,
  from: "PENDING" | "ACCEPTED",
  to: "ACCEPTED" | "PACKED",
) {
  const r = await db.transaction(async (tx) => {
    const [so] = await tx
      .update(sellerOrders)
      .set({ status: to, updatedAt: new Date() })
      .where(
        and(
          eq(sellerOrders.id, sellerOrderId),
          eq(sellerOrders.sellerId, seller.id),
          eq(sellerOrders.status, from),
        ),
      )
      .returning();
    if (!so) throw new DomainError("This order has already moved on — refresh to see its latest state.");
    const verb = to === "ACCEPTED" ? "accepted the order" : "packed the items";
    await logEvent(tx, so.orderId, "seller", `${seller.storeName} ${verb}`, { sellerOrderId });
    return recomputeOrder(tx, so.orderId);
  });
  if (to === "ACCEPTED") await removeJob("seller-orders", jobIds.acceptTimeout(sellerOrderId));
  await afterChange(r);
}

export const acceptSellerOrder = (seller: { id: string; storeName: string }, id: string) =>
  transitionSellerOrder(seller, id, "PENDING", "ACCEPTED");

export const packSellerOrder = (seller: { id: string; storeName: string }, id: string) =>
  transitionSellerOrder(seller, id, "ACCEPTED", "PACKED");

/**
 * Rejects a pending seller order (seller declined, or the accept timer ran out) and tries to
 * move each of its items to the next-cheapest nearby seller. Items nobody else can supply are
 * refunded. If nothing is left, the whole order is cancelled.
 */
export async function rejectSellerOrder(
  sellerOrderId: string,
  opts: { reason: string; actor: Role | null; sellerId?: string },
) {
  const result = await db.transaction(async (tx) => {
    const [so] = await tx
      .update(sellerOrders)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(
        and(
          eq(sellerOrders.id, sellerOrderId),
          eq(sellerOrders.status, "PENDING"),
          opts.sellerId ? eq(sellerOrders.sellerId, opts.sellerId) : undefined,
        ),
      )
      .returning();
    if (!so) return null;

    // Lock the order so concurrent rejections of sibling seller orders reassign one at a time.
    const [order] = await tx.select().from(orders).where(eq(orders.id, so.orderId)).for("update");
    const loc = fromPoint(order.deliveryLocation);

    const rejectedSellers = (
      await tx
        .select({ sellerId: sellerOrders.sellerId })
        .from(sellerOrders)
        .where(and(eq(sellerOrders.orderId, order.id), eq(sellerOrders.status, "REJECTED")))
    ).map((r) => r.sellerId);

    const items = await tx
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.sellerOrderId, so.id), eq(orderItems.status, "ACTIVE")));

    await logEvent(tx, order.id, opts.actor, opts.reason, { sellerOrderId });

    const touched = new Set<string>();
    const newSellerOrders: { id: string; sellerId: string }[] = [];
    let refund = 0;

    for (const item of items) {
      await tx
        .update(offers)
        .set({ stock: sql`${offers.stock} + ${item.qty}` })
        .where(eq(offers.id, item.offerId));

      const [alt] = await tx.execute<{ offerId: string; sellerId: string; storeName: string; pricePaise: number }>(sql`
        select o.id as "offerId", s.id as "sellerId", s.store_name as "storeName", o.price_paise as "pricePaise"
        from offers o join sellers s on s.id = o.seller_id
        where o.product_id = ${item.productId}
          and ${offerAvailableAt(loc, { minStock: item.qty })}
          ${rejectedSellers.length ? sql`and s.id not in ${rejectedSellers}` : sql``}
        order by o.price_paise, ${distanceFrom(loc)}
        limit 1
      `);
      const claimed =
        alt &&
        (
          await tx
            .update(offers)
            .set({ stock: sql`${offers.stock} - ${item.qty}` })
            .where(and(eq(offers.id, alt.offerId), sql`${offers.stock} >= ${item.qty}`))
            .returning({ id: offers.id })
        ).length > 0;

      if (!claimed) {
        await tx.update(orderItems).set({ status: "REFUNDED" }).where(eq(orderItems.id, item.id));
        refund += item.qty * item.unitPricePaise;
        await logEvent(tx, order.id, null, `${item.productName} unavailable nearby — refunded`);
        continue;
      }

      let target = newSellerOrders.find((s) => s.sellerId === alt.sellerId);
      if (!target) {
        const [existing] = await tx
          .select({ id: sellerOrders.id, sellerId: sellerOrders.sellerId })
          .from(sellerOrders)
          .where(
            and(
              eq(sellerOrders.orderId, order.id),
              eq(sellerOrders.sellerId, alt.sellerId),
              eq(sellerOrders.status, "PENDING"),
            ),
          );
        target =
          existing ??
          (
            await tx
              .insert(sellerOrders)
              .values({
                orderId: order.id,
                sellerId: alt.sellerId,
                acceptBy: new Date(Date.now() + acceptTimeoutMs()),
              })
              .returning({ id: sellerOrders.id, sellerId: sellerOrders.sellerId })
          )[0];
        if (!existing) newSellerOrders.push(target);
      }

      await tx.update(orderItems).set({ status: "REASSIGNED" }).where(eq(orderItems.id, item.id));
      await tx.insert(orderItems).values({
        orderId: order.id,
        sellerOrderId: target.id,
        offerId: alt.offerId,
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        qty: item.qty,
        unitPricePaise: alt.pricePaise,
      });
      touched.add(target.id);
      // The customer already paid; if the replacement is cheaper they get the difference back.
      // If it is dearer, the platform absorbs it.
      if (alt.pricePaise < item.unitPricePaise) refund += (item.unitPricePaise - alt.pricePaise) * item.qty;
      await logEvent(tx, order.id, null, `${item.productName} moved to ${alt.storeName}`);
    }

    for (const id of touched) await retotalSellerOrder(tx, id);
    if (refund > 0) {
      await tx
        .update(orders)
        .set({ refundedPaise: sql`least(${orders.refundedPaise} + ${refund}, ${orders.totalPaise})` })
        .where(eq(orders.id, order.id));
    }

    const r = await recomputeOrder(tx, order.id);
    return { r, newSellerOrders };
  });

  if (!result) return false;
  for (const so of result.newSellerOrders) {
    await publish(`seller:${so.sellerId}`, { type: "seller.new", sellerOrderId: so.id, orderId: result.r.orderId });
    await enqueue(
      "seller-orders",
      { kind: "accept-timeout", sellerOrderId: so.id },
      { jobId: jobIds.acceptTimeout(so.id), delay: acceptTimeoutMs() },
    );
  }
  await afterChange(result.r);
  return true;
}

// ---------------------------------------------------------------------------
// Rider transitions
// ---------------------------------------------------------------------------

export class NoRiderAvailableError extends Error {}

/** Claims the nearest online rider for an order. Throws NoRiderAvailableError so BullMQ retries. */
export async function assignRider(orderId: string, candidates: string[]) {
  for (const riderId of candidates) {
    const r = await db.transaction(async (tx) => {
      const [delivery] = await tx
        .select()
        .from(deliveries)
        .where(eq(deliveries.orderId, orderId))
        .for("update");
      if (!delivery || delivery.status !== "SEARCHING") return "done" as const;

      const [rider] = await tx
        .update(riders)
        .set({ status: "BUSY" })
        .where(and(eq(riders.id, riderId), eq(riders.status, "ONLINE"), eq(riders.approval, "APPROVED")))
        .returning();
      if (!rider) return null;

      await tx
        .update(deliveries)
        .set({ riderId, status: "ASSIGNED", assignedAt: new Date() })
        .where(eq(deliveries.id, delivery.id));
      await logEvent(tx, orderId, null, "Delivery partner assigned", { riderId });
      return { deliveryId: delivery.id, recomputed: await recomputeOrder(tx, orderId) };
    });
    if (r === "done") return null;
    if (r) {
      await publish(`rider:${riderId}`, { type: "rider.assigned", deliveryId: r.deliveryId, orderId });
      await afterChange(r.recomputed);
      return riderId;
    }
  }
  throw new NoRiderAvailableError(`No rider available for order ${orderId}`);
}

export async function pickUpSellerOrder(riderId: string, sellerOrderId: string) {
  const r = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ so: sellerOrders, delivery: deliveries, storeName: schema.sellers.storeName })
      .from(sellerOrders)
      .innerJoin(deliveries, eq(deliveries.orderId, sellerOrders.orderId))
      .innerJoin(schema.sellers, eq(schema.sellers.id, sellerOrders.sellerId))
      .where(and(eq(sellerOrders.id, sellerOrderId), eq(deliveries.riderId, riderId)))
      .for("update", { of: [sellerOrders, deliveries] });
    if (!row) throw new DomainError("This pickup isn't assigned to you.");
    if (row.so.status !== "PACKED") throw new DomainError("The store hasn't packed this order yet.");

    await tx
      .update(sellerOrders)
      .set({ status: "PICKED_UP", updatedAt: new Date() })
      .where(eq(sellerOrders.id, sellerOrderId));
    await logEvent(tx, row.so.orderId, "rider", `Picked up from ${row.storeName}`, { sellerOrderId });

    const remaining = await tx
      .select({ id: sellerOrders.id })
      .from(sellerOrders)
      .where(
        and(
          eq(sellerOrders.orderId, row.so.orderId),
          notInArray(sellerOrders.status, ["PICKED_UP", ...INACTIVE_SELLER_ORDER]),
        ),
      );
    const allPicked = remaining.length === 0;
    await tx
      .update(deliveries)
      .set(
        allPicked
          ? { status: "OUT_FOR_DELIVERY", pickedUpAt: new Date() }
          : { status: "PICKING" },
      )
      .where(eq(deliveries.id, row.delivery.id));
    return recomputeOrder(tx, row.so.orderId);
  });
  await afterChange(r);
}

export async function completeDelivery(riderId: string, deliveryId: string) {
  const r = await db.transaction(async (tx) => {
    const [delivery] = await tx
      .update(deliveries)
      .set({ status: "DELIVERED", deliveredAt: new Date() })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.riderId, riderId),
          eq(deliveries.status, "OUT_FOR_DELIVERY"),
        ),
      )
      .returning();
    if (!delivery) throw new DomainError("Pick up every bag before marking the order delivered.");
    await tx
      .update(sellerOrders)
      .set({ status: "DELIVERED", updatedAt: new Date() })
      .where(and(eq(sellerOrders.orderId, delivery.orderId), eq(sellerOrders.status, "PICKED_UP")));
    await logEvent(tx, delivery.orderId, "rider", "Handed over to customer");
    const recomputed = await recomputeOrder(tx, delivery.orderId);
    const released = await releaseRider(tx, riderId);
    return { recomputed, released, orderId: delivery.orderId };
  });
  if (r.released) await markRiderAvailable(r.released.id, r.released);
  await enqueue("ledger", { orderId: r.orderId }, { jobId: jobIds.ledger(r.orderId) });
  await afterChange(r.recomputed);
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Writes SALE and COMMISSION ledger rows for each delivered seller order. Idempotent. */
export async function postLedgerForOrder(orderId: string) {
  const sos = await db
    .select()
    .from(sellerOrders)
    .where(and(eq(sellerOrders.orderId, orderId), eq(sellerOrders.status, "DELIVERED")));
  if (sos.length === 0) return 0;
  await db
    .insert(schema.ledgerEntries)
    .values(
      sos.flatMap((so) => [
        {
          sellerId: so.sellerId,
          sellerOrderId: so.id,
          type: "SALE" as const,
          amountPaise: so.subtotalPaise,
          note: `Order #${orderId.slice(0, 8)}`,
        },
        {
          sellerId: so.sellerId,
          sellerOrderId: so.id,
          type: "COMMISSION" as const,
          amountPaise: -so.commissionPaise,
          note: `Platform commission`,
        },
      ]),
    )
    .onConflictDoNothing();
  return sos.length;
}

export async function sellerBalance(sellerId: string) {
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${schema.ledgerEntries.amountPaise}), 0)::int` })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.sellerId, sellerId));
  return row.balance;
}

/** Mock payout: records a PAYOUT for the seller's full balance. */
export async function settleSeller(sellerId: string) {
  return db.transaction(async (tx) => {
    // Serialize payouts per seller so two clicks can't both pay the same balance.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${sellerId}))`);
    const [row] = await tx
      .select({ balance: sql<number>`coalesce(sum(${schema.ledgerEntries.amountPaise}), 0)::int` })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.sellerId, sellerId));
    if (row.balance <= 0) return 0;
    await tx.insert(schema.ledgerEntries).values({
      sellerId,
      type: "PAYOUT",
      amountPaise: -row.balance,
      note: `Payout ref PO-${Date.now().toString(36).toUpperCase()}`,
    });
    return row.balance;
  });
}

