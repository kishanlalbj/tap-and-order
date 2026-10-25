import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Loader2, MapPin, PartyPopper, Store } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { EventTimeline, formatTime, SellerOrderItems, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { Bill } from "@/components/shop/bill";
import { OrderProgress } from "@/components/shop/order-progress";
import { RiderTracker } from "@/components/shop/rider-tracker";
import { requireUser } from "@/server/authz";
import { STATUS_MESSAGES } from "@/server/domain/orders";
import { getOrderDetail } from "@/server/queries/orders";
import { distanceM } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const user = await requireUser("customer");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getOrderDetail(id);
  if (!detail || detail.order.customerId !== user.id) notFound();
  const { order, sellerOrders, delivery, rider, events } = detail;
  const justPlaced = (await searchParams).placed === "1" && order.status === "PLACED";

  const active = sellerOrders.filter((s) => s.status !== "REJECTED" && s.status !== "CANCELLED");
  const live = !["DELIVERED", "CANCELLED"].includes(order.status);

  const riderHeading =
    delivery?.status === "OUT_FOR_DELIVERY"
      ? "Heading to you with your order"
      : delivery?.status === "PICKING"
        ? `Collecting from ${active.length} store${active.length > 1 ? "s" : ""}`
        : "Heading to the store";

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      {live && <LiveRefresh channel={`order:${order.id}`} />}
      <Link href="/orders" className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All orders
      </Link>

      {justPlaced && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
          <PartyPopper className="size-6" />
          <div>
            <p className="font-semibold">Order placed!</p>
            <p className="text-sm text-primary-foreground/85">
              We&apos;ve sent it to {sellerOrders.length} store{sellerOrders.length > 1 ? "s" : ""}. Follow along live here.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Order #{shortId(order.id)}</h1>
            <p className="text-xs text-muted-foreground">Placed {formatTime(order.createdAt)}</p>
          </div>
          <div className="flex gap-1.5">
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <OrderProgress status={order.status} />
        <p className="flex items-center gap-2 text-sm font-medium">
          {live && <Loader2 className="size-4 animate-spin text-primary" />}
          {STATUS_MESSAGES[order.status]}
        </p>

        {rider && live && delivery?.status !== "SEARCHING" && (
          <RiderTracker orderId={order.id} destination={order.location} rider={rider} heading={riderHeading} />
        )}
        {delivery?.status === "SEARCHING" && ["CONFIRMED", "PACKED"].includes(order.status) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Finding a delivery partner near the store…</p>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <MapPin className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="font-medium">{order.addressLabel}</p>
            <p className="text-muted-foreground">{order.addressLine}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">From {sellerOrders.length > 1 ? `${sellerOrders.length} stores` : "1 store"}</h2>
        {sellerOrders.map((so) => (
          <div key={so.id} className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium">
                <Store className="size-4 text-primary" /> {so.storeName}
                <span className="text-xs font-normal text-muted-foreground">
                  {formatDistance(distanceM(so.storeLocation, order.location))} away
                </span>
              </p>
              <StatusBadge status={so.status} />
            </div>
            <SellerOrderItems so={so} />
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Bill</h2>
          <Bill
            subtotalPaise={order.subtotalPaise}
            deliveryFeePaise={order.deliveryFeePaise}
            totalPaise={order.totalPaise}
            refundedPaise={order.refundedPaise}
          />
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Activity</h2>
          <EventTimeline events={events} />
        </section>
      </div>
    </div>
  );
}
