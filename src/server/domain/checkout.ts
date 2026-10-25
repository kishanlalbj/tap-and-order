import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { toPoint, type LatLng } from "@/lib/geo";
import { commissionFor, deliveryFeeFor } from "@/lib/money";
import { enqueue, jobIds } from "@/lib/queue";
import { publish } from "@/lib/realtime";
import { offerAvailableAt } from "./availability";
import { acceptTimeoutMs, broadcastOrder, DomainError, logEvent } from "./orders";

const { offers, orders, sellerOrders, orderItems, deliveries, addresses } = schema;

type PlaceOrderInput = {
  customerId: string;
  location: LatLng & { label: string };
  addressLine: string;
  saveAddress: boolean;
  cart: Record<string, number>; // offerId -> qty
};

type AvailableOffer = {
  offerId: string;
  sellerId: string;
  commissionBps: number;
  productId: string;
  productName: string;
  unit: string;
  pricePaise: number;
};

/**
 * Turns a cart into one customer order with one seller order per store. Stock is reserved with
 * conditional decrements inside the transaction, so two buyers can never take the last unit.
 * Payment is mocked as instantly successful.
 */
export async function placeOrder(input: PlaceOrderInput) {
  const offerIds = Object.keys(input.cart);
  if (offerIds.length === 0) throw new DomainError("Your cart is empty.");

  const result = await db.transaction(async (tx) => {
    const available = [
      ...(await tx.execute<AvailableOffer>(sql`
        select o.id as "offerId", s.id as "sellerId", s.commission_bps as "commissionBps",
               p.id as "productId", p.name as "productName", p.unit, o.price_paise as "pricePaise"
        from offers o
        join sellers s on s.id = o.seller_id
        join products p on p.id = o.product_id
        where o.id in ${offerIds} and p.active and ${offerAvailableAt(input.location)}
      `)),
    ];
    if (available.length !== offerIds.length) {
      throw new DomainError("Some items are no longer available at your location. Please review your cart.");
    }

    for (const o of available) {
      const qty = input.cart[o.offerId];
      const ok = await tx
        .update(offers)
        .set({ stock: sql`${offers.stock} - ${qty}`, updatedAt: new Date() })
        .where(and(eq(offers.id, o.offerId), sql`${offers.stock} >= ${qty}`))
        .returning({ id: offers.id });
      if (ok.length === 0) throw new DomainError(`Only a few ${o.productName} left — reduce the quantity.`);
    }

    const bySeller = Map.groupBy(available, (o) => o.sellerId);
    const subtotal = available.reduce((sum, o) => sum + o.pricePaise * input.cart[o.offerId], 0);
    const fee = deliveryFeeFor(subtotal);

    const [order] = await tx
      .insert(orders)
      .values({
        customerId: input.customerId,
        addressLabel: input.location.label,
        addressLine: input.addressLine,
        deliveryLocation: toPoint(input.location),
        subtotalPaise: subtotal,
        deliveryFeePaise: fee,
        totalPaise: subtotal + fee,
        paymentStatus: "PAID",
      })
      .returning();

    const acceptBy = new Date(Date.now() + acceptTimeoutMs());
    const createdSellerOrders: { id: string; sellerId: string }[] = [];
    for (const [sellerId, items] of bySeller) {
      const soSubtotal = items.reduce((sum, o) => sum + o.pricePaise * input.cart[o.offerId], 0);
      const [so] = await tx
        .insert(sellerOrders)
        .values({
          orderId: order.id,
          sellerId,
          subtotalPaise: soSubtotal,
          commissionPaise: commissionFor(soSubtotal, items[0].commissionBps),
          acceptBy,
        })
        .returning({ id: sellerOrders.id, sellerId: sellerOrders.sellerId });
      createdSellerOrders.push(so);
      await tx.insert(orderItems).values(
        items.map((o) => ({
          orderId: order.id,
          sellerOrderId: so.id,
          offerId: o.offerId,
          productId: o.productId,
          productName: o.productName,
          unit: o.unit,
          qty: input.cart[o.offerId],
          unitPricePaise: o.pricePaise,
        })),
      );
    }

    await tx.insert(deliveries).values({ orderId: order.id, feePaise: fee });
    await logEvent(tx, order.id, "customer", "Order placed and payment received", {
      stores: createdSellerOrders.length,
    });

    if (input.saveAddress) {
      const existing = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(and(eq(addresses.userId, input.customerId), eq(addresses.line, input.addressLine)));
      if (existing.length === 0) {
        await tx.insert(addresses).values({
          userId: input.customerId,
          label: input.location.label,
          line: input.addressLine,
          location: toPoint(input.location),
        });
      }
    }

    return { orderId: order.id, sellerOrders: createdSellerOrders };
  });

  for (const so of result.sellerOrders) {
    await publish(`seller:${so.sellerId}`, { type: "seller.new", sellerOrderId: so.id, orderId: result.orderId });
    await enqueue(
      "seller-orders",
      { kind: "accept-timeout", sellerOrderId: so.id },
      { jobId: jobIds.acceptTimeout(so.id), delay: acceptTimeoutMs() },
    );
  }
  await enqueue("notifications", {
    to: input.customerId,
    channel: "sms",
    message: `Order #${result.orderId.slice(0, 8)} placed with ${result.sellerOrders.length} store(s)`,
  });
  await broadcastOrder(result.orderId, "PLACED");
  return result.orderId;
}

