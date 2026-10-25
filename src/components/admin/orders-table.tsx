import Link from "next/link";
import { formatPaise } from "@/lib/money";
import { formatTime, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AdminOrderRow } from "@/server/queries/admin";

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Stores</th>
            <th className="px-3 py-2 font-medium">Rider</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:underline">
                  #{shortId(o.id)}
                </Link>
                <p className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</p>
              </td>
              <td className="px-3 py-2">
                {o.customerName}
                <p className="text-xs text-muted-foreground">{o.addressLabel}</p>
              </td>
              <td className="max-w-56 px-3 py-2 text-xs">{o.stores?.join(", ") ?? "—"}</td>
              <td className="px-3 py-2 text-xs">
                {o.riderName ?? (o.deliveryStatus === "SEARCHING" ? <span className="text-amber-700">searching…</span> : "—")}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {formatPaise(o.totalPaise - o.refundedPaise)}
                {o.refundedPaise > 0 && <p className="text-xs font-normal text-orange-700">−{formatPaise(o.refundedPaise)} refunded</p>}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-muted-foreground">
                No orders
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
