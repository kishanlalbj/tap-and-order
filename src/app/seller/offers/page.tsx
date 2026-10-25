import Link from "next/link";
import { PackagePlus, Trophy } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { OfferRowEditor } from "@/components/seller/offer-row-editor";
import { requireSeller } from "@/server/authz";
import { listMyOffers } from "@/server/queries/seller";

export const dynamic = "force-dynamic";
export const metadata = { title: "My listings" };

export default async function MyOffersPage() {
  const { seller } = await requireSeller();
  const offers = await listMyOffers(seller.id);
  const winning = offers.filter((o) => o.competitorMinPaise === null || o.pricePaise <= o.competitorMinPaise).length;

  return (
    <div>
      <PageHeader
        title="My listings"
        description={`${offers.length} products listed. You have the best price nearby on ${winning}. Customers see the cheapest store first.`}
        action={
          <Link href="/seller/offers/new" className={buttonVariants()}>
            <PackagePlus /> Add products
          </Link>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {offers.map((o) => {
            const beaten = o.competitorMinPaise !== null && o.competitorMinPaise < o.pricePaise;
            return (
              <li key={o.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !o.active && "opacity-60")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl">{o.icon}</span>
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.brand ? `${o.brand} · ` : ""}
                    {o.unit} · MRP {formatPaise(o.mrpPaise)}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {o.competitorMinPaise === null ? (
                      <span className="text-muted-foreground">No other store nearby sells this</span>
                    ) : beaten ? (
                      <span className="text-rose-700">
                        Undercut: {o.competitorCount} nearby store{o.competitorCount > 1 ? "s" : ""}, lowest{" "}
                        {formatPaise(o.competitorMinPaise)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Trophy className="size-3" /> Best price among {o.competitorCount + 1} stores
                      </span>
                    )}
                    {o.stock === 0 && <span className="ml-2 font-medium text-rose-700">Out of stock</span>}
                  </p>
                </div>
                <OfferRowEditor
                  offerId={o.id}
                  price={o.pricePaise / 100}
                  stock={o.stock}
                  active={o.active}
                  suggestedPrice={beaten && o.competitorMinPaise! >= 100 ? o.competitorMinPaise! / 100 : undefined}
                />
              </li>
            );
          })}
        </ul>
        {offers.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">You haven&apos;t listed anything yet.</p>
        )}
      </div>
    </div>
  );
}
