import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

const rows = async <T,>(q: SQL) => [...(await db.execute(q))] as T[];

const TODAY = sql`date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;

export async function overviewStats() {
  const [r] = await rows<{
    ordersToday: number;
    gmvToday: number;
    commissionToday: number;
    liveOrders: number;
    ridersOnline: number;
    ridersBusy: number;
    pendingSellers: number;
    pendingRiders: number;
    pendingRequests: number;
    rejectionsToday: number;
  }>(sql`
    select
      (select count(*)::int from orders where created_at >= ${TODAY}) as "ordersToday",
      (select coalesce(sum(total_paise - refunded_paise), 0)::int from orders where created_at >= ${TODAY}) as "gmvToday",
      (select coalesce(sum(commission_paise), 0)::int from seller_orders
         where status = 'DELIVERED' and updated_at >= ${TODAY}) as "commissionToday",
      (select count(*)::int from orders where status not in ('DELIVERED','CANCELLED')) as "liveOrders",
      (select count(*)::int from riders where status = 'ONLINE') as "ridersOnline",
      (select count(*)::int from riders where status = 'BUSY') as "ridersBusy",
      (select count(*)::int from sellers where status = 'PENDING') as "pendingSellers",
      (select count(*)::int from riders where approval = 'PENDING') as "pendingRiders",
      (select count(*)::int from product_requests where status = 'PENDING') as "pendingRequests",
      (select count(*)::int from seller_orders where status = 'REJECTED' and updated_at >= ${TODAY}) as "rejectionsToday"
  `);
  return r;
}

export type AdminOrderRow = {
  id: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  refundedPaise: number;
  createdAt: Date;
  customerName: string;
  addressLabel: string;
  stores: string[] | null;
  deliveryStatus: string | null;
  riderName: string | null;
};

export async function listOrders({ status, live }: { status?: string; live?: boolean } = {}) {
  return rows<AdminOrderRow>(sql`
    select o.id, o.status, o.payment_status as "paymentStatus", o.total_paise as "totalPaise",
           o.refunded_paise as "refundedPaise", o.created_at as "createdAt", u.name as "customerName",
           o.address_label as "addressLabel",
           (select array_agg(s.store_name order by so.created_at) from seller_orders so
              join sellers s on s.id = so.seller_id
              where so.order_id = o.id and so.status not in ('REJECTED','CANCELLED')) as stores,
           d.status as "deliveryStatus", ru.name as "riderName"
    from orders o
    join users u on u.id = o.customer_id
    left join deliveries d on d.order_id = o.id
    left join riders r on r.id = d.rider_id
    left join users ru on ru.id = r.user_id
    where true
      ${status ? sql`and o.status = ${status}` : sql``}
      ${live ? sql`and o.status not in ('DELIVERED','CANCELLED')` : sql``}
    order by o.created_at desc
    limit 100
  `);
}

export async function listSellers() {
  return rows<{
    id: string;
    storeName: string;
    addressLine: string;
    status: string;
    commissionBps: number;
    serviceRadiusM: number;
    isAcceptingOrders: boolean;
    email: string;
    ownerName: string;
    liveOffers: number;
    deliveredOrders: number;
    rejectedOrders: number;
    balance: number;
    createdAt: Date;
  }>(sql`
    select s.id, s.store_name as "storeName", s.address_line as "addressLine", s.status,
           s.commission_bps as "commissionBps", s.service_radius_m as "serviceRadiusM",
           s.is_accepting_orders as "isAcceptingOrders", u.email, u.name as "ownerName", s.created_at as "createdAt",
           (select count(*)::int from offers o where o.seller_id = s.id and o.active and o.stock > 0) as "liveOffers",
           (select count(*)::int from seller_orders so where so.seller_id = s.id and so.status = 'DELIVERED') as "deliveredOrders",
           (select count(*)::int from seller_orders so where so.seller_id = s.id and so.status = 'REJECTED') as "rejectedOrders",
           (select coalesce(sum(amount_paise), 0)::int from ledger_entries l where l.seller_id = s.id) as balance
    from sellers s join users u on u.id = s.user_id
    order by (s.status = 'PENDING') desc, s.created_at desc
  `);
}

export async function listRiders() {
  return rows<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    vehicle: string;
    approval: string;
    status: string;
    lastSeenAt: Date | null;
    delivered: number;
  }>(sql`
    select r.id, u.name, u.email, u.phone, r.vehicle, r.approval, r.status, r.last_seen_at as "lastSeenAt",
           (select count(*)::int from deliveries d where d.rider_id = r.id and d.status = 'DELIVERED') as delivered
    from riders r join users u on u.id = r.user_id
    order by (r.approval = 'PENDING') desc, u.name
  `);
}

export async function listProducts(q?: string) {
  const term = q?.trim();
  return rows<{
    id: string;
    name: string;
    brand: string | null;
    unit: string;
    active: boolean;
    icon: string;
    categoryName: string;
    sellers: number;
    minPrice: number | null;
    maxPrice: number | null;
  }>(sql`
    select p.id, p.name, p.brand, p.unit, p.active, c.icon, c.name as "categoryName",
           count(o.id)::int as sellers, min(o.price_paise)::int as "minPrice", max(o.price_paise)::int as "maxPrice"
    from products p
    join categories c on c.id = p.category_id
    left join offers o on o.product_id = p.id and o.active
    ${term ? sql`where p.name ilike ${"%" + term + "%"} or p.brand ilike ${"%" + term + "%"}` : sql``}
    group by p.id, c.id
    order by c.sort_order, p.name
  `);
}

export async function pendingProductRequests() {
  return rows<{
    id: string;
    name: string;
    brand: string | null;
    unit: string;
    note: string | null;
    categoryName: string;
    storeName: string;
    createdAt: Date;
  }>(sql`
    select r.id, r.name, r.brand, r.unit, r.note, c.name as "categoryName", s.store_name as "storeName",
           r.created_at as "createdAt"
    from product_requests r
    join categories c on c.id = r.category_id
    join sellers s on s.id = r.seller_id
    where r.status = 'PENDING'
    order by r.created_at
  `);
}

export async function payoutSummary() {
  return rows<{ id: string; storeName: string; sales: number; commission: number; paid: number; balance: number; lastPayout: Date | null }>(sql`
    select s.id, s.store_name as "storeName",
           coalesce(sum(l.amount_paise) filter (where l.type = 'SALE'), 0)::int as sales,
           coalesce(-sum(l.amount_paise) filter (where l.type = 'COMMISSION'), 0)::int as commission,
           coalesce(-sum(l.amount_paise) filter (where l.type = 'PAYOUT'), 0)::int as paid,
           coalesce(sum(l.amount_paise), 0)::int as balance,
           max(l.created_at) filter (where l.type = 'PAYOUT') as "lastPayout"
    from sellers s
    left join ledger_entries l on l.seller_id = s.id
    where s.status <> 'PENDING'
    group by s.id
    order by balance desc
  `);
}
