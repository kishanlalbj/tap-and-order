import "server-only";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { sellerOrders, orderItems, orders, deliveries, riders, users, ledgerEntries } = schema;

const OPEN_STATUSES = ["PENDING", "ACCEPTED", "PACKED"] as const;

export async function getSellerBoard(sellerId: string) {
  const [open, recent] = await Promise.all([
    db
      .select({ so: sellerOrders, addressLabel: orders.addressLabel, deliveryStatus: deliveries.status, riderName: users.name })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .leftJoin(deliveries, eq(deliveries.orderId, sellerOrders.orderId))
      .leftJoin(riders, eq(riders.id, deliveries.riderId))
      .leftJoin(users, eq(users.id, riders.userId))
      .where(and(eq(sellerOrders.sellerId, sellerId), inArray(sellerOrders.status, [...OPEN_STATUSES])))
      .orderBy(sellerOrders.createdAt),
    db
      .select({ so: sellerOrders })
      .from(sellerOrders)
      .where(and(eq(sellerOrders.sellerId, sellerId), notInArray(sellerOrders.status, [...OPEN_STATUSES])))
      .orderBy(desc(sellerOrders.updatedAt))
      .limit(15),
  ]);

  const ids = [...open.map((r) => r.so.id), ...recent.map((r) => r.so.id)];
  const items = ids.length
    ? await db
        .select()
        .from(orderItems)
        .where(and(inArray(orderItems.sellerOrderId, ids)))
    : [];
  const itemsFor = (id: string) => items.filter((i) => i.sellerOrderId === id);

  return {
    open: open.map((r) => ({
      ...r.so,
      addressLabel: r.addressLabel,
      deliveryStatus: r.deliveryStatus,
      riderName: r.riderName,
      items: itemsFor(r.so.id).filter((i) => i.status === "ACTIVE"),
    })),
    recent: recent.map((r) => ({ ...r.so, items: itemsFor(r.so.id) })),
  };
}

export type BoardOrder = Awaited<ReturnType<typeof getSellerBoard>>["open"][number];

export async function getSellerStats(sellerId: string) {
  const [row] = await db.execute<{ todayOrders: number; todaySales: number; balance: number; liveOffers: number; outOfStock: number }>(sql`
    select
      (select count(*)::int from seller_orders
        where seller_id = ${sellerId} and status not in ('REJECTED','CANCELLED')
          and created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as "todayOrders",
      (select coalesce(sum(subtotal_paise), 0)::int from seller_orders
        where seller_id = ${sellerId} and status not in ('REJECTED','CANCELLED')
          and created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as "todaySales",
      (select coalesce(sum(amount_paise), 0)::int from ledger_entries where seller_id = ${sellerId}) as balance,
      (select count(*)::int from offers where seller_id = ${sellerId} and active and stock > 0) as "liveOffers",
      (select count(*)::int from offers where seller_id = ${sellerId} and active and stock = 0) as "outOfStock"
  `);
  return row;
}

export type MyOffer = {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  unit: string;
  icon: string;
  pricePaise: number;
  mrpPaise: number;
  stock: number;
  active: boolean;
  competitorMinPaise: number | null;
  competitorCount: number;
};

/** The seller's listings, each with the cheapest competing price within 5 km of the store. */
export async function listMyOffers(sellerId: string) {
  const rows = await db.execute<MyOffer>(sql`
    select o.id, p.id as "productId", p.name, p.brand, p.unit, c.icon,
           o.price_paise as "pricePaise", o.mrp_paise as "mrpPaise", o.stock, o.active,
           comp.min_price as "competitorMinPaise", comp.n::int as "competitorCount"
    from offers o
    join sellers s on s.id = o.seller_id
    join products p on p.id = o.product_id
    join categories c on c.id = p.category_id
    left join lateral (
      select min(o2.price_paise)::int as min_price, count(*) as n
      from offers o2 join sellers s2 on s2.id = o2.seller_id
      where o2.product_id = o.product_id and s2.id <> s.id and s2.status = 'APPROVED'
        and o2.active and o2.stock > 0
        and ST_DWithin(s2.location::geography, s.location::geography, 5000)
    ) comp on true
    where o.seller_id = ${sellerId}
    order by c.sort_order, p.name
  `);
  return [...rows];
}

export async function catalogForSeller(sellerId: string, q?: string, categoryId?: number) {
  const term = q?.trim();
  const rows = await db.execute<{
    id: string;
    name: string;
    brand: string | null;
    unit: string;
    icon: string;
    categoryName: string;
    myOfferId: string | null;
    marketMinPaise: number | null;
    marketMaxMrpPaise: number | null;
  }>(sql`
    select p.id, p.name, p.brand, p.unit, c.icon, c.name as "categoryName",
           mine.id as "myOfferId",
           (select min(price_paise)::int from offers o2 where o2.product_id = p.id and o2.active) as "marketMinPaise",
           (select max(mrp_paise)::int from offers o2 where o2.product_id = p.id) as "marketMaxMrpPaise"
    from products p
    join categories c on c.id = p.category_id
    left join offers mine on mine.product_id = p.id and mine.seller_id = ${sellerId}
    where p.active
      ${term ? sql`and (p.name ilike ${"%" + term + "%"} or p.brand ilike ${"%" + term + "%"})` : sql``}
      ${categoryId ? sql`and p.category_id = ${categoryId}` : sql``}
    order by (mine.id is not null), c.sort_order, p.name
    limit 100
  `);
  return [...rows];
}

export async function getLedger(sellerId: string) {
  return db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.sellerId, sellerId))
    .orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id))
    .limit(200);
}

export async function myProductRequests(sellerId: string) {
  return db
    .select()
    .from(schema.productRequests)
    .where(eq(schema.productRequests.sellerId, sellerId))
    .orderBy(desc(schema.productRequests.createdAt))
    .limit(20);
}
