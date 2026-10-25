import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { EventTimeline, formatTime, SellerOrderItems, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { Bill } from "@/components/shop/bill";
import { getOrderDetail } from "@/server/queries/orders";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, customer, sellerOrders, delivery, rider, events } = detail;

  return (
    <div className="grid gap-5">
      <Link href="/admin/orders" className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Orders
      </Link>
      <PageHeader
        title={`Order #${shortId(order.id)}`}
        description={`${customer.name} · ${order.addressLine}, ${order.addressLabel} · ${formatTime(order.createdAt)}`}
        action={
          <div className="flex gap-1.5">
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-3">
          {sellerOrders.map((so) => (
            <section key={so.id} className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">{so.storeName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  commission {formatPaise(so.commissionPaise)}
                  <StatusBadge status={so.status} />
                </div>
              </div>
              <SellerOrderItems so={so} />
            </section>
          ))}
          <section className="rounded-xl border bg-card p-4 text-sm">
            <p className="mb-1 font-medium">Delivery</p>
            <div className="flex items-center gap-2">
              {delivery && <StatusBadge status={delivery.status} />}
              <span className="text-muted-foreground">
                {rider ? `${rider.name} (${rider.vehicle}) · ${rider.phone ?? ""}` : "No rider assigned"}
              </span>
            </div>
          </section>
        </div>
        <div className="grid content-start gap-3">
          <section className="rounded-xl border bg-card p-4">
            <Bill
              subtotalPaise={order.subtotalPaise}
              deliveryFeePaise={order.deliveryFeePaise}
              totalPaise={order.totalPaise}
              refundedPaise={order.refundedPaise}
            />
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Timeline</h2>
            <EventTimeline events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
