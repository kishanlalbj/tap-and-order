import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/server/queries/catalog";
import { ProductCard } from "./product-card";

type CartByProduct = Record<string, { offerId: string; qty: number }>;

export function ProductGrid({ products, cart }: { products: ProductCardData[]; cart: CartByProduct }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} inCart={cart[p.id]} />
      ))}
    </div>
  );
}

export function CategoryRail({
  categories,
  active,
}: {
  categories: { slug: string; name: string; icon: string }[];
  active?: string;
}) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition hover:border-primary",
            active === c.slug && "border-primary bg-primary/10 font-medium text-primary",
          )}
        >
          <span>{c.icon}</span>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

export function NotServiceable({ label }: { label: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
      <MapPinOff className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">No stores deliver to {label} yet</h2>
      <p className="text-sm text-muted-foreground">
        We&apos;re onboarding neighbourhood stores fast. Try another location, such as Koramangala, which has 4 stores.
      </p>
    </div>
  );
}
