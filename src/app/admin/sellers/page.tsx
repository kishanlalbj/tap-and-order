import { formatDistance } from "@/lib/geo";
import { formatPaise } from "@/lib/money";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { formatTime } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { CommissionEditor } from "@/components/admin/commission-editor";
import { setSellerStatus } from "@/server/actions/admin";
import { listSellers } from "@/server/queries/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sellers" };

export default async function AdminSellers() {
  const sellers = await listSellers();
  return (
    <div>
      <PageHeader title="Selling partners" description="Approve applications, manage commission, suspend stores." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Store</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Listings</th>
              <th className="px-3 py-2 font-medium">Orders</th>
              <th className="px-3 py-2 font-medium">Commission</th>
              <th className="px-3 py-2 font-medium">Balance</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sellers.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{s.storeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.ownerName} · {s.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.addressLine} · {formatDistance(s.serviceRadiusM)} radius · joined {formatTime(s.createdAt)}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                  {s.status === "APPROVED" && !s.isAcceptingOrders && <p className="mt-1 text-xs text-muted-foreground">paused</p>}
                </td>
                <td className="px-3 py-2 tabular-nums">{s.liveOffers}</td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {s.deliveredOrders} delivered
                  {s.rejectedOrders > 0 && <p className="text-rose-700">{s.rejectedOrders} rejected</p>}
                </td>
                <td className="px-3 py-2">
                  <CommissionEditor sellerId={s.id} percent={s.commissionBps / 100} />
                </td>
                <td className="px-3 py-2 tabular-nums">{formatPaise(s.balance)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {s.status !== "APPROVED" && (
                    <ActionButton action={setSellerStatus.bind(null, s.id, "APPROVED")} successMessage="Store approved and live">
                      Approve
                    </ActionButton>
                  )}
                  {s.status === "APPROVED" && (
                    <ActionButton
                      variant="destructive"
                      action={setSellerStatus.bind(null, s.id, "SUSPENDED")}
                      confirm={`Suspend ${s.storeName}? Their listings disappear immediately.`}
                      successMessage="Store suspended"
                    >
                      Suspend
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
