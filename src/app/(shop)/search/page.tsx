import { Search } from "lucide-react";
import { ProductGrid } from "@/components/shop/catalog";
import { getSessionUser } from "@/server/authz";
import { getCartByProduct } from "@/server/cart";
import { getLocation } from "@/server/location";
import { listProductsNearby } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const [loc, user] = await Promise.all([getLocation(), getSessionUser()]);
  const [products, cart] = await Promise.all([
    q ? listProductsNearby({ loc, q, limit: 60 }) : Promise.resolve([]),
    user?.role === "customer" ? getCartByProduct(user.id) : {},
  ]);

  return (
    <div className="grid gap-5">
      <form className="relative">
        <Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Search for products, brands…"
          className="h-12 w-full rounded-xl border bg-card pr-4 pl-11 text-base outline-none focus:border-ring"
        />
      </form>
      {q && (
        <p className="text-sm text-muted-foreground">
          {products.length > 0
            ? `${products.length} results for “${q}” near ${loc.label}`
            : `Nothing matching “${q}” is available near ${loc.label}.`}
        </p>
      )}
      {products.length > 0 && <ProductGrid products={products} cart={cart} />}
    </div>
  );
}
