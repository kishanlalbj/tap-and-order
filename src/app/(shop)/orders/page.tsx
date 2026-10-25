import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { formatTime, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/server/authz";
import { listCustomerOrders } from "@/server/queries/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("customer");
  const orders = await listCustomerOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
        <Receipt className="size-12 text-muted-foreground" />
        <h1 className="text-lg font-semibold">No orders yet</h1>
        <Link href="/" className={buttonVariants()}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">My orders</h1>
      <ul className="grid gap-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">#{shortId(o.id)}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {o.items.map((i) => `${i.qty} × ${i.name}`).join(", ") || "No items"}
                </p>
                <p className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</p>
              </div>
              <span className="font-semibold">{formatPaise(o.totalPaise - o.refundedPaise)}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
