import Link from "next/link";
import { formatPaise } from "@/lib/money";
import { OrdersTable } from "@/components/admin/orders-table";
import { PageHeader, StatCard } from "@/components/shared/dashboard-shell";
import { listOrders, overviewStats } from "@/server/queries/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [stats, live] = await Promise.all([overviewStats(), listOrders({ live: true })]);
  const approvals = [
    { n: stats.pendingSellers, label: "seller applications", href: "/admin/sellers" },
    { n: stats.pendingRiders, label: "rider applications", href: "/admin/riders" },
    { n: stats.pendingRequests, label: "product requests", href: "/admin/catalog" },
  ].filter((a) => a.n > 0);

  return (
    <div className="grid gap-6">
      <PageHeader title="Overview" description="Live view of the marketplace. Updates in real time." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders today" value={stats.ordersToday} hint={`${stats.liveOrders} in progress`} />
        <StatCard label="GMV today" value={formatPaise(stats.gmvToday)} hint="Net of refunds" />
        <StatCard label="Commission today" value={formatPaise(stats.commissionToday)} hint="From delivered orders" />
        <StatCard
          label="Riders"
          value={`${stats.ridersOnline + stats.ridersBusy} online`}
          hint={`${stats.ridersBusy} on a delivery · ${stats.rejectionsToday} store rejections today`}
        />
      </div>

      {approvals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {approvals.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900 hover:bg-amber-100"
            >
              {a.n} pending {a.label} →
            </Link>
          ))}
        </div>
      )}

      <section className="grid gap-2">
        <h2 className="font-semibold">Live orders</h2>
        <OrdersTable orders={live} />
      </section>
    </div>
  );
}
