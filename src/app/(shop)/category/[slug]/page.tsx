import { notFound } from "next/navigation";
import { CategoryRail, NotServiceable, ProductGrid } from "@/components/shop/catalog";
import { getSessionUser } from "@/server/authz";
import { getCartByProduct } from "@/server/cart";
import { getLocation } from "@/server/location";
import { getCategories, listProductsNearby } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [loc, user, categories] = await Promise.all([getLocation(), getSessionUser(), getCategories()]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const [products, cart] = await Promise.all([
    listProductsNearby({ loc, categorySlug: slug, limit: 200 }),
    user?.role === "customer" ? getCartByProduct(user.id) : {},
  ]);

  return (
    <div className="grid gap-5">
      <CategoryRail categories={categories} active={slug} />
      <h1 className="text-xl font-semibold">
        {category.icon} {category.name}
        <span className="ml-2 text-sm font-normal text-muted-foreground">{products.length} items</span>
      </h1>
      {products.length === 0 ? <NotServiceable label={loc.label} /> : <ProductGrid products={products} cart={cart} />}
    </div>
  );
}
