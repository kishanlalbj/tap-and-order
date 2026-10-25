import Link from "next/link";
import { cn } from "@/lib/utils";
import { OrdersTable } from "@/components/admin/orders-table";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { humanize } from "@/components/shared/status-badge";
import { schema } from "@/db";
import { listOrders } from "@/server/queries/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = schema.orderStatusEnum.enumValues.find((s) => s === status);
  const orders = await listOrders({ status: valid });

  return (
    <div>
      <PageHeader title="Orders" description="Latest 100 orders" />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[undefined, ...schema.orderStatusEnum.enumValues].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/orders?status=${s}` : "/admin/orders"}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              valid === s && "border-primary bg-primary/10 text-primary",
            )}
          >
            {s ? humanize(s) : "All"}
          </Link>
        ))}
      </div>
      <OrdersTable orders={orders} />
    </div>
  );
}
