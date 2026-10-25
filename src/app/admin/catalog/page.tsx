import { Search } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { formatTime } from "@/components/shared/order-parts";
import { ProductForm } from "@/components/admin/product-form";
import { reviewProductRequest, setProductActive } from "@/server/actions/admin";
import { listProducts, pendingProductRequests } from "@/server/queries/admin";
import { getCategories } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue" };

export default async function AdminCatalog({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [products, requests, categories] = await Promise.all([listProducts(q), pendingProductRequests(), getCategories()]);

  return (
    <div>
      <PageHeader
        title="Master catalogue"
        description="One product, many sellers. Sellers attach their own price and stock to these products."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3">
          {requests.length > 0 && (
            <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
              <h2 className="mb-2 font-semibold">Product requests from sellers</h2>
              <ul className="grid gap-2">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 text-sm">
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">
                        {r.name} <span className="text-xs text-muted-foreground">{r.brand} · {r.unit}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.categoryName} · from {r.storeName} · {formatTime(r.createdAt)}
                        {r.note && <> · &ldquo;{r.note}&rdquo;</>}
                      </p>
                    </div>
                    <ActionButton action={reviewProductRequest.bind(null, r.id, true)}>Approve</ActionButton>
                    <ActionButton variant="ghost" action={reviewProductRequest.bind(null, r.id, false)}>
                      Reject
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder={`Search ${products.length} products`}
              className="h-9 w-full rounded-lg border bg-card pr-3 pl-8 text-sm outline-none focus:border-ring"
            />
          </form>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Sellers</th>
                  <th className="px-3 py-2 font-medium">Price range</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className={cn(!p.active && "opacity-50")}>
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {p.icon} {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.brand ? `${p.brand} · ` : ""}
                        {p.unit}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.categoryName}</td>
                    <td className="px-3 py-2 tabular-nums">{p.sellers}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {p.minPrice !== null
                        ? p.minPrice === p.maxPrice
                          ? formatPaise(p.minPrice)
                          : `${formatPaise(p.minPrice)} to ${formatPaise(p.maxPrice!)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ActionButton variant="ghost" action={setProductActive.bind(null, p.id, !p.active)}>
                        {p.active ? "Disable" : "Enable"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="h-fit rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Add a product</h2>
          <ProductForm categories={categories} />
        </aside>
      </div>
    </div>
  );
}
