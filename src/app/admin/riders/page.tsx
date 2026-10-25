import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { formatTime } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { setRiderApproval } from "@/server/actions/admin";
import { listRiders } from "@/server/queries/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Riders" };

export default async function AdminRiders() {
  const riders = await listRiders();
  return (
    <div>
      <PageHeader title="Delivery partners" description="Our own fleet. Approve new riders and see who's online." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Rider</th>
              <th className="px-3 py-2 font-medium">Vehicle</th>
              <th className="px-3 py-2 font-medium">Approval</th>
              <th className="px-3 py-2 font-medium">Now</th>
              <th className="px-3 py-2 font-medium">Delivered</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {riders.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.email} · {r.phone}
                  </p>
                </td>
                <td className="px-3 py-2 capitalize">{r.vehicle}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.approval} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 tabular-nums">{r.delivered}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.lastSeenAt ? formatTime(r.lastSeenAt) : "never"}</td>
                <td className="px-3 py-2 text-right">
                  {r.approval !== "APPROVED" ? (
                    <ActionButton action={setRiderApproval.bind(null, r.id, "APPROVED")} successMessage="Rider approved">
                      Approve
                    </ActionButton>
                  ) : (
                    <ActionButton
                      variant="destructive"
                      action={setRiderApproval.bind(null, r.id, "SUSPENDED")}
                      confirm={`Suspend ${r.name}?`}
                      successMessage="Rider suspended"
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
