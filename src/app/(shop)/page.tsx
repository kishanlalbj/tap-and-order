import Link from "next/link";
import { ChevronRight, Clock, Store, Tag } from "lucide-react";
import { CategoryRail, NotServiceable, ProductGrid } from "@/components/shop/catalog";
import { getSessionUser } from "@/server/authz";
import { getCartByProduct } from "@/server/cart";
import { getLocation } from "@/server/location";
import { countNearbySellers, getCategories, listProductsNearby } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [loc, user] = await Promise.all([getLocation(), getSessionUser()]);
  const [categories, products, sellerCount, cart] = await Promise.all([
    getCategories(),
    listProductsNearby({ loc, limit: 200 }),
    countNearbySellers(loc),
    user?.role === "customer" ? getCartByProduct(user.id) : {},
  ]);

  const byCategory = Map.groupBy(products, (p) => p.categorySlug);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-700 p-6 text-primary-foreground sm:grid-cols-[1fr_auto] sm:p-8">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">The lowest price nearby, at your door in minutes</h1>
          <p className="max-w-xl text-sm text-primary-foreground/85">
            We compare every neighbourhood store around you, pick the cheapest one for each item, and our riders bring it
            all together in one delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-end text-sm sm:flex-col">
          <span className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
            <Store className="size-4" /> {sellerCount} stores near {loc.label}
          </span>
          <span className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
            <Tag className="size-4" /> Best price picked automatically
          </span>
          <span className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
            <Clock className="size-4" /> Free delivery above ₹199
          </span>
        </div>
      </section>

      {products.length === 0 ? (
        <NotServiceable label={loc.label} />
      ) : (
        <>
          <CategoryRail categories={categories} />
          {categories
            .filter((c) => byCategory.has(c.slug))
            .map((c) => {
              const items = byCategory.get(c.slug)!;
              return (
                <section key={c.slug} className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {c.icon} {c.name}
                    </h2>
                    {items.length > 6 && (
                      <Link
                        href={`/category/${c.slug}`}
                        className="flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        See all {items.length} <ChevronRight className="size-4" />
                      </Link>
                    )}
                  </div>
                  <ProductGrid products={items.slice(0, 6)} cart={cart} />
                </section>
              );
            })}
        </>
      )}
    </div>
  );
}
