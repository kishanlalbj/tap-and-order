import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/shared/dashboard-shell";
import { formatTime } from "@/components/shared/order-parts";
import { requireSeller } from "@/server/authz";
import { getLedger } from "@/server/queries/seller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

const TYPE_LABEL = { SALE: "Sale", COMMISSION: "Commission", PAYOUT: "Payout" } as const;

export default async function EarningsPage() {
  const { seller } = await requireSeller();
  const entries = await getLedger(seller.id);
  const sum = (type: keyof typeof TYPE_LABEL) =>
    entries.filter((e) => e.type === type).reduce((a, e) => a + e.amountPaise, 0);
  const balance = entries.reduce((a, e) => a + e.amountPaise, 0);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Earnings"
        description={`Sales are credited once an order is delivered. Platform commission is ${seller.commissionBps / 100}% of the items total.`}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross sales" value={formatPaise(sum("SALE"))} />
        <StatCard label="Commission" value={formatPaise(-sum("COMMISSION"))} />
        <StatCard label="Paid out" value={formatPaise(-sum("PAYOUT"))} />
        <StatCard label="Balance due to you" value={formatPaise(balance)} hint="Settled by the platform" />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatTime(e.createdAt)}</td>
                <td className="px-3 py-2">{TYPE_LABEL[e.type]}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.note}</td>
                <td className={cn("px-3 py-2 text-right font-medium tabular-nums", e.amountPaise < 0 ? "text-rose-700" : "text-emerald-700")}>
                  {e.amountPaise < 0 ? "−" : "+"}
                  {formatPaise(Math.abs(e.amountPaise))}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  No settlements yet. They appear here after your first delivered order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
