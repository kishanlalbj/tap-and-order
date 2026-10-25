import { formatPaise } from "@/lib/money";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader, StatCard } from "@/components/shared/dashboard-shell";
import { formatTime } from "@/components/shared/order-parts";
import { settlePayout } from "@/server/actions/admin";
import { payoutSummary } from "@/server/queries/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

export default async function AdminPayouts() {
  const rows = await payoutSummary();
  const total = (k: "sales" | "commission" | "paid" | "balance") => rows.reduce((a, r) => a + r[k], 0);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Seller payouts"
        description="Delivered orders credit the seller's ledger (sale − commission). Settling records a payout for the full balance. Bank transfer is simulated."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Seller sales" value={formatPaise(total("sales"))} />
        <StatCard label="Platform commission" value={formatPaise(total("commission"))} />
        <StatCard label="Paid out" value={formatPaise(total("paid"))} />
        <StatCard label="Outstanding" value={formatPaise(total("balance"))} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Store</th>
              <th className="px-3 py-2 text-right font-medium">Sales</th>
              <th className="px-3 py-2 text-right font-medium">Commission</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Last payout</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.storeName}</td>
                <td className="px-3 py-2 text-right">{formatPaise(r.sales)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatPaise(r.commission)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatPaise(r.paid)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatPaise(r.balance)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.lastPayout ? formatTime(r.lastPayout) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <ActionButton
                    action={settlePayout.bind(null, r.id)}
                    disabled={r.balance <= 0}
                    confirm={`Pay ${formatPaise(r.balance)} to ${r.storeName}?`}
                  >
                    Settle
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
