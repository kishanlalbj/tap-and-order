import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { fromPoint } from "@/lib/geo";

const { orders, sellerOrders, orderItems, sellers, deliveries, riders, users, orderEvents } = schema;

/** Everything needed to render one order, for whichever party is looking at it. */
export async function getOrderDetail(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const [sos, items, deliveryRows, events, customer] = await Promise.all([
    db
      .select({
        so: sellerOrders,
        storeName: sellers.storeName,
        storeAddress: sellers.addressLine,
        storeLocation: sellers.location,
      })
      .from(sellerOrders)
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .where(eq(sellerOrders.orderId, orderId))
      .orderBy(asc(sellerOrders.createdAt)),
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db
      .select({ delivery: deliveries, rider: riders, riderName: users.name, riderPhone: users.phone })
      .from(deliveries)
      .leftJoin(riders, eq(riders.id, deliveries.riderId))
      .leftJoin(users, eq(users.id, riders.userId))
      .where(eq(deliveries.orderId, orderId)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(desc(orderEvents.createdAt)),
    db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, order.customerId)),
  ]);

  const d = deliveryRows[0];
  return {
    order: { ...order, location: fromPoint(order.deliveryLocation) },
    customer: customer[0],
    sellerOrders: sos.map((r) => ({
      ...r.so,
      storeName: r.storeName,
      storeAddress: r.storeAddress,
      storeLocation: fromPoint(r.storeLocation),
      items: items.filter((i) => i.sellerOrderId === r.so.id),
    })),
    delivery: d?.delivery ?? null,
    rider:
      d?.rider && d.riderName
        ? {
            id: d.rider.id,
            name: d.riderName,
            phone: d.riderPhone,
            vehicle: d.rider.vehicle,
            location: d.rider.lastLocation ? fromPoint(d.rider.lastLocation) : null,
          }
        : null,
    events,
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export async function listCustomerOrders(customerId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, name: orderItems.productName, qty: orderItems.qty, status: orderItems.status })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id && i.status === "ACTIVE"),
  }));
}
