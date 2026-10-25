import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { redis } from "@/lib/redis";
import type { LatLng } from "@/lib/geo";
import { deliveryFeeFor, FREE_DELIVERY_ABOVE_PAISE } from "@/lib/money";
import { distanceFrom, offerAvailableAt } from "@/server/domain/availability";

/** Carts live in a Redis hash per user: offerId -> quantity. */
const cartKey = (userId: string) => `cart:${userId}`;

export const MAX_QTY_PER_ITEM = 10;

export async function getCart(userId: string): Promise<Record<string, number>> {
  const raw = await redis.hgetall(cartKey(userId));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
}

export async function cartCount(userId: string) {
  const cart = await getCart(userId);
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

export async function setCartQty(userId: string, offerId: string, qty: number) {
  if (qty <= 0) await redis.hdel(cartKey(userId), offerId);
  else await redis.hset(cartKey(userId), offerId, Math.min(qty, MAX_QTY_PER_ITEM));
  await redis.expire(cartKey(userId), 60 * 60 * 24 * 14);
}

export async function clearCart(userId: string) {
  await redis.del(cartKey(userId));
}

/** productId -> { offerId, qty } for what's in the cart; lets product cards show their stepper. */
export async function getCartByProduct(userId: string) {
  const cart = await getCart(userId);
  const ids = Object.keys(cart);
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: schema.offers.id, productId: schema.offers.productId })
    .from(schema.offers)
    .where(inArray(schema.offers.id, ids));
  return Object.fromEntries(rows.map((r) => [r.productId, { offerId: r.id, qty: cart[r.id] }]));
}

export type CartLine = {
  offerId: string;
  productId: string;
  name: string;
  unit: string;
  icon: string;
  sellerId: string;
  storeName: string;
  pricePaise: number;
  mrpPaise: number;
  stock: number;
  qty: number;
  distanceM: number;
  /** Cheapest price for this product among nearby stores, to nudge a switch. */
  bestPricePaise: number | null;
  problem: null | "unavailable" | "low-stock";
};

export async function getCartDetails(userId: string, loc: LatLng) {
  const cart = await getCart(userId);
  const ids = Object.keys(cart);
  if (ids.length === 0) return null;

  const rows = await db.execute<Omit<CartLine, "qty" | "problem"> & { available: boolean }>(sql`
    select o.id as "offerId", p.id as "productId", p.name, p.unit, c.icon,
           s.id as "sellerId", s.store_name as "storeName",
           o.price_paise as "pricePaise", o.mrp_paise as "mrpPaise", o.stock,
           ${distanceFrom(loc)} as "distanceM",
           (p.active and ${offerAvailableAt(loc)}) as available,
           (select min(o2.price_paise) from offers o2 join sellers s2 on s2.id = o2.seller_id
             where o2.product_id = p.id and ${offerAvailableAt(loc, { offer: "o2", seller: "s2" })}
           ) as "bestPricePaise"
    from offers o
    join sellers s on s.id = o.seller_id
    join products p on p.id = o.product_id
    join categories c on c.id = p.category_id
    where o.id in ${ids}
    order by s.store_name, p.name
  `);

  // Offers deleted since they were added simply drop out of the cart.
  const lines: CartLine[] = [...rows].map(({ available, ...r }) => {
    const qty = cart[r.offerId];
    const problem = !available ? "unavailable" : r.stock < qty ? "low-stock" : null;
    return { ...r, qty, problem };
  });

  const groups = [...Map.groupBy(lines, (l) => l.sellerId).values()].map((items) => ({
    sellerId: items[0].sellerId,
    storeName: items[0].storeName,
    distanceM: items[0].distanceM,
    items,
  }));
  const valid = lines.filter((l) => !l.problem);
  const subtotalPaise = valid.reduce((sum, l) => sum + l.pricePaise * l.qty, 0);
  const mrpTotalPaise = valid.reduce((sum, l) => sum + l.mrpPaise * l.qty, 0);
  const deliveryFeePaise = subtotalPaise > 0 ? deliveryFeeFor(subtotalPaise) : 0;

  return {
    lines,
    groups,
    subtotalPaise,
    savingsPaise: mrpTotalPaise - subtotalPaise,
    deliveryFeePaise,
    totalPaise: subtotalPaise + deliveryFeePaise,
    freeDeliveryGapPaise: Math.max(0, FREE_DELIVERY_ABOVE_PAISE - subtotalPaise),
    hasProblems: lines.some((l) => l.problem),
    itemCount: lines.reduce((a, l) => a + l.qty, 0),
  };
}

export type CartDetails = NonNullable<Awaited<ReturnType<typeof getCartDetails>>>;
