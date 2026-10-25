/**
 * End-to-end smoke test of the order lifecycle against real Postgres, Redis and a running worker.
 * Run `pnpm db:seed`, start `pnpm worker`, then `pnpm smoke`.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BENGALURU_AREAS, toPoint } from "@/lib/geo";
import { redis } from "@/lib/redis";
import { placeOrder } from "@/server/domain/checkout";
import { offerAvailableAt } from "@/server/domain/availability";
import {
  acceptSellerOrder,
  completeDelivery,
  DomainError,
  packSellerOrder,
  pickUpSellerOrder,
  rejectSellerOrder,
  settleSeller,
} from "@/server/domain/orders";
import { markRiderAvailable } from "@/server/domain/riders";

const koramangala = { ...BENGALURU_AREAS.find((a) => a.label === "Koramangala")! };

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
}

async function waitFor<T>(label: string, fn: () => Promise<T | null | undefined | false>, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`✗ timed out waiting for: ${label}`);
}

const sellerOrdersOf = (orderId: string) =>
  db
    .select({ so: schema.sellerOrders, storeName: schema.sellers.storeName })
    .from(schema.sellerOrders)
    .innerJoin(schema.sellers, eq(schema.sellers.id, schema.sellerOrders.sellerId))
    .where(eq(schema.sellerOrders.orderId, orderId));

const orderOf = async (orderId: string) =>
  (await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)))[0];

/** Cheapest offer per product near Koramangala, picked so the cart spans several stores. */
async function multiStoreCart() {
  const best = [
    ...(await db.execute<{ offerId: string; sellerId: string; productId: string }>(sql`
      select distinct on (o.product_id) o.id as "offerId", s.id as "sellerId", o.product_id as "productId"
      from offers o join sellers s on s.id = o.seller_id
      where ${offerAvailableAt(koramangala, { minStock: 3 })}
      order by o.product_id, o.price_paise
    `)),
  ];
  const bySeller = Map.groupBy(best, (b) => b.sellerId);
  const picks = [...bySeller.values()].slice(0, 3).map((offers) => offers[0]);
  return Object.fromEntries(picks.map((p) => [p.offerId, 2]));
}

async function main() {
  const [customer] = await db.select().from(schema.users).where(eq(schema.users.email, "asha@tap.dev"));
  assert(customer, "seeded customer exists");

  // Put one rider online near the stores.
  const [riderUser] = await db.select().from(schema.users).where(eq(schema.users.email, "rider1@tap.dev"));
  const [rider] = await db
    .update(schema.riders)
    .set({ status: "ONLINE", lastLocation: toPoint(koramangala) })
    .where(eq(schema.riders.userId, riderUser.id))
    .returning();
  await markRiderAvailable(rider.id, koramangala);

  // --- Checkout --------------------------------------------------------------------------------
  const cart = await multiStoreCart();
  const offerIds = Object.keys(cart);
  const stockBefore = await db
    .select({ id: schema.offers.id, stock: schema.offers.stock })
    .from(schema.offers)
    .where(inArray(schema.offers.id, offerIds));

  const orderId = await placeOrder({
    customerId: customer.id,
    location: koramangala,
    addressLine: "Flat 101, Smoke Test Apartments",
    saveAddress: false,
    cart,
  });
  let sos = await sellerOrdersOf(orderId);
  assert(sos.length === offerIds.length && sos.length >= 2, `one order split into ${sos.length} seller orders`);

  const stockAfter = await db
    .select({ id: schema.offers.id, stock: schema.offers.stock })
    .from(schema.offers)
    .where(inArray(schema.offers.id, offerIds));
  assert(
    stockAfter.every((a) => a.stock === stockBefore.find((b) => b.id === a.id)!.stock - 2),
    "stock reserved for every line",
  );

  // --- Oversell protection ---------------------------------------------------------------------
  const [someOffer] = stockAfter;
  const oversell = await placeOrder({
    customerId: customer.id,
    location: koramangala,
    addressLine: "x",
    saveAddress: false,
    cart: { [someOffer.id]: someOffer.stock + 1 },
  }).catch((e) => e);
  assert(oversell instanceof DomainError, `overselling is rejected ("${oversell.message}")`);

  // --- Sellers: first two accept and pack, the last one rejects --------------------------------
  const [first, ...rest] = sos;
  const rejecting = rest.at(-1)!;
  for (const s of [first, ...rest.slice(0, -1)]) {
    await acceptSellerOrder({ id: s.so.sellerId, storeName: s.storeName }, s.so.id);
    await packSellerOrder({ id: s.so.sellerId, storeName: s.storeName }, s.so.id);
  }
  await rejectSellerOrder(rejecting.so.id, { reason: "smoke: out of stock", actor: "seller", sellerId: rejecting.so.sellerId });

  sos = await sellerOrdersOf(orderId);
  const replacements = sos.filter((s) => s.so.status === "PENDING");
  const order1 = await orderOf(orderId);
  assert(
    replacements.length > 0 || order1.refundedPaise > 0,
    replacements.length > 0
      ? `rejected items reassigned to ${replacements.map((r) => r.storeName).join(", ")}`
      : "rejected items refunded (no other store had them)",
  );
  for (const s of replacements) {
    await acceptSellerOrder({ id: s.so.sellerId, storeName: s.storeName }, s.so.id);
    await packSellerOrder({ id: s.so.sellerId, storeName: s.storeName }, s.so.id);
  }
  assert((await orderOf(orderId)).status === "PACKED", "order is PACKED once every active store packed");

  // --- Dispatch (worker) -----------------------------------------------------------------------
  const delivery = await waitFor("rider assignment", async () => {
    const [d] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.orderId, orderId));
    return d?.status === "ASSIGNED" ? d : null;
  });
  assert(delivery.riderId === rider.id, "worker assigned the nearest online rider");

  // --- Pickup and delivery ---------------------------------------------------------------------
  sos = await sellerOrdersOf(orderId);
  for (const s of sos.filter((s) => s.so.status === "PACKED")) await pickUpSellerOrder(rider.id, s.so.id);
  assert((await orderOf(orderId)).status === "OUT_FOR_DELIVERY", "out for delivery after the last pickup");
  await completeDelivery(rider.id, delivery.id);
  assert((await orderOf(orderId)).status === "DELIVERED", "order delivered");
  const [riderAfter] = await db.select().from(schema.riders).where(eq(schema.riders.id, rider.id));
  assert(riderAfter.status === "ONLINE", "rider is free again");

  // --- Ledger (worker) and payout --------------------------------------------------------------
  const delivered = (await sellerOrdersOf(orderId)).filter((s) => s.so.status === "DELIVERED");
  await waitFor("ledger entries", async () => {
    const rows = await db
      .select()
      .from(schema.ledgerEntries)
      .where(inArray(schema.ledgerEntries.sellerOrderId, delivered.map((s) => s.so.id)));
    return rows.length === delivered.length * 2;
  });
  assert(true, "SALE and COMMISSION posted for each delivered store");
  const paid = await settleSeller(delivered[0].so.sellerId);
  const [bal] = await db
    .select({ b: sql<number>`coalesce(sum(amount_paise),0)::int` })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.sellerId, delivered[0].so.sellerId));
  assert(paid > 0 && bal.b === 0, `payout of ₹${(paid / 100).toFixed(2)} settles the balance to zero`);

  // --- Accept timeout (worker) -----------------------------------------------------------------
  process.env.SELLER_ACCEPT_TIMEOUT_S = "2";
  const cart2 = await multiStoreCart();
  const [oneOffer] = Object.keys(cart2);
  const order2 = await placeOrder({
    customerId: customer.id,
    location: koramangala,
    addressLine: "Flat 101, Smoke Test Apartments",
    saveAddress: false,
    cart: { [oneOffer]: 1 },
  });
  const [original] = await sellerOrdersOf(order2);
  await waitFor(
    "accept timeout",
    async () => (await sellerOrdersOf(order2)).find((s) => s.so.id === original.so.id)?.so.status === "REJECTED",
    15_000,
  );
  const after2 = await sellerOrdersOf(order2);
  const o2 = await orderOf(order2);
  assert(
    after2.length > 1 || o2.status === "CANCELLED",
    after2.length > 1 ? "unaccepted order timed out and moved to another store" : "unaccepted order timed out and was refunded",
  );
  // Leave nothing pending for the demo.
  // Each rejection may hand the item to yet another store, so repeat until nothing is pending.
  for (let i = 0; i < 10; i++) {
    const pending = (await sellerOrdersOf(order2)).filter((s) => s.so.status === "PENDING");
    if (pending.length === 0) break;
    for (const s of pending) await rejectSellerOrder(s.so.id, { reason: "smoke cleanup", actor: "admin" });
  }

  await db
    .update(schema.riders)
    .set({ status: "OFFLINE" })
    .where(and(eq(schema.riders.id, rider.id), eq(schema.riders.status, "ONLINE")));
  await redis.zrem("riders:online", rider.id);
  console.log("\nAll smoke checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
