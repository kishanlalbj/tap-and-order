import { Bike, Clock, Hourglass, MapPin } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { PageHeader, StatCard } from "@/components/shared/dashboard-shell";
import { formatTime, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { Countdown, PackAction, PendingActions } from "@/components/seller/seller-controls";
import { getSellerForUser, requireUser } from "@/server/authz";
import { getSellerBoard, getSellerStats, type BoardOrder } from "@/server/queries/seller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller orders" };

function OrderCard({ so, children }: { so: BoardOrder; children?: React.ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">#{shortId(so.orderId)}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {so.addressLabel} · {formatTime(so.createdAt)}
          </p>
        </div>
        <span className="font-semibold">{formatPaise(so.subtotalPaise)}</span>
      </div>
      <ul className="grid gap-0.5 rounded-lg bg-muted/60 p-2 text-sm">
        {so.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-2">
            <span className="truncate">
              <span className="font-semibold">{i.qty}×</span> {i.productName}{" "}
              <span className="text-xs text-muted-foreground">{i.unit}</span>
            </span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function Column({ title, icon, orders, children }: { title: string; icon: React.ReactNode; orders: BoardOrder[]; children: (so: BoardOrder) => React.ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-2xl bg-muted/50 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
        <span className="ml-auto rounded-full bg-background px-2 text-xs">{orders.length}</span>
      </h2>
      {orders.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nothing here</p>
      ) : (
        orders.map((so) => (
          <OrderCard key={so.id} so={so}>
            {children(so)}
          </OrderCard>
        ))
      )}
    </section>
  );
}

export default async function SellerHome() {
  const user = await requireUser("seller");
  const seller = (await getSellerForUser(user.id))!;

  if (seller.status !== "APPROVED") {
    return (
      <div className="mx-auto mt-10 grid max-w-lg gap-3 rounded-2xl border bg-card p-6 text-center">
        <Hourglass className="mx-auto size-10 text-amber-500" />
        <h1 className="text-lg font-semibold">
          {seller.status === "PENDING" ? "Your store is under review" : "Your store is suspended"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {seller.status === "PENDING"
            ? "Our team verifies every selling partner before they go live. You'll be able to list products as soon as you're approved. You can complete your store settings meanwhile."
            : "Contact partner support to reactivate your store."}
        </p>
        <StatusBadge status={seller.status} className="mx-auto" />
      </div>
    );
  }

  const [board, stats] = await Promise.all([getSellerBoard(seller.id), getSellerStats(seller.id)]);
  const pending = board.open.filter((o) => o.status === "PENDING");
  const accepted = board.open.filter((o) => o.status === "ACCEPTED");
  const packed = board.open.filter((o) => o.status === "PACKED");

  return (
    <div className="grid gap-6">
      <PageHeader title={seller.storeName} description="Orders update live. Accept quickly or they'll be passed to another store." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders today" value={stats.todayOrders} />
        <StatCard label="Sales today" value={formatPaise(stats.todaySales)} />
        <StatCard label="Live listings" value={stats.liveOffers} hint={stats.outOfStock ? `${stats.outOfStock} out of stock` : undefined} />
        <StatCard label="Payable balance" value={formatPaise(stats.balance)} hint="After commission" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="New" icon={<Clock className="size-4 text-amber-600" />} orders={pending}>
          {(so) => (
            <>
              <Countdown until={so.acceptBy.toISOString()} />
              <PendingActions id={so.id} />
            </>
          )}
        </Column>
        <Column title="Packing" icon={<Hourglass className="size-4 text-indigo-600" />} orders={accepted}>
          {(so) => <PackAction id={so.id} />}
        </Column>
        <Column title="Ready for pickup" icon={<Bike className="size-4 text-violet-600" />} orders={packed}>
          {(so) => (
            <p className="text-xs text-muted-foreground">
              {so.riderName ? `Rider ${so.riderName} is on the way` : "Assigning a rider…"}
            </p>
          )}
        </Column>
      </div>

      <section className="grid gap-2">
        <h2 className="font-semibold">Recent</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          {board.recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No completed orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {board.recent.map((so) => (
                  <tr key={so.id}>
                    <td className="px-3 py-2 font-medium">#{shortId(so.orderId)}</td>
                    <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                      {so.items.filter((i) => i.status === "ACTIVE").length || so.items.length} items
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTime(so.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={so.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatPaise(so.subtotalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
