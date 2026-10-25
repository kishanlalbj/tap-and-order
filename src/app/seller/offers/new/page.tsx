import Link from "next/link";
import { Search } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddOfferForm, RequestProductForm } from "@/components/seller/add-offer-forms";
import { requireSeller } from "@/server/authz";
import { getCategories } from "@/server/queries/catalog";
import { catalogForSeller, myProductRequests } from "@/server/queries/seller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add products" };

export default async function AddProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { seller } = await requireSeller();
  const { q, category } = await searchParams;
  const categoryId = category ? Number(category) : undefined;
  const [products, categories, requests] = await Promise.all([
    catalogForSeller(seller.id, q, categoryId),
    getCategories(),
    myProductRequests(seller.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Add products"
        description="Pick from the shared catalogue and set your own price and stock. Customers comparing stores see your offer instantly."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-3">
          <form className="flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search the catalogue"
                className="h-9 w-full rounded-lg border bg-card pr-3 pl-8 text-sm outline-none focus:border-ring"
              />
            </div>
            {categoryId && <input type="hidden" name="category" value={categoryId} />}
          </form>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/seller/offers/new${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={cn("rounded-full border px-2.5 py-1 text-xs", !categoryId && "border-primary bg-primary/10 text-primary")}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/seller/offers/new?category=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  categoryId === c.id && "border-primary bg-primary/10 text-primary",
                )}
              >
                {c.icon} {c.name}
              </Link>
            ))}
          </div>

          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl">{p.icon}</span>
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">
                    {p.name}{" "}
                    {p.myOfferId && (
                      <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Listed</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.brand ? `${p.brand} · ` : ""}
                    {p.unit} · {p.categoryName}
                    {p.marketMinPaise !== null && ` · market from ${formatPaise(p.marketMinPaise)}`}
                  </p>
                </div>
                <AddOfferForm
                  productId={p.id}
                  listed={!!p.myOfferId}
                  suggestedMrp={p.marketMaxMrpPaise ? p.marketMaxMrpPaise / 100 : undefined}
                  marketMin={p.marketMinPaise ? p.marketMinPaise / 100 : undefined}
                />
              </li>
            ))}
            {products.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Nothing found. Request the product on the right.
              </li>
            )}
          </ul>
        </div>

        <aside className="grid h-fit gap-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-1 font-semibold">Can&apos;t find a product?</h2>
            <p className="mb-3 text-xs text-muted-foreground">Request it and our catalogue team will add it for every seller.</p>
            <RequestProductForm categories={categories} />
          </section>
          {requests.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">Your requests</h2>
              <ul className="grid gap-2 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {r.name} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
