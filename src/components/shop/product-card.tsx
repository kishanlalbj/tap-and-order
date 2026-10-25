import Link from "next/link";
import { Store } from "lucide-react";
import { formatPaise } from "@/lib/money";
import type { ProductCardData } from "@/server/queries/catalog";
import { QtyStepper } from "./qty-stepper";

type Props = {
  product: ProductCardData;
  /** If the cart already holds this product (from any store), show that line's stepper. */
  inCart?: { offerId: string; qty: number };
};

export function discountPct(price: number, mrp: number) {
  return mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
}

export function ProductImage({ icon, imageUrl, className }: { icon: string; imageUrl?: string | null; className?: string }) {
  return (
    <div className={`grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-muted to-muted/40 ${className ?? ""}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full rounded-xl object-cover" />
      ) : (
        <span className="text-5xl drop-shadow-sm">{icon}</span>
      )}
    </div>
  );
}

export function ProductCard({ product: p, inCart }: Props) {
  const off = discountPct(p.bestPricePaise, p.bestMrpPaise);
  return (
    <div className="group relative flex flex-col gap-2 rounded-2xl border bg-card p-2.5 transition hover:shadow-md">
      {off > 0 && (
        <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {off}% OFF
        </span>
      )}
      <ProductImage icon={p.categoryIcon} imageUrl={p.imageUrl} />
      <div className="flex flex-1 flex-col gap-0.5 px-0.5">
        <Link href={`/product/${p.id}`} className="line-clamp-2 text-sm leading-tight font-medium after:absolute after:inset-0">
          {p.name}
        </Link>
        <p className="text-xs text-muted-foreground">{p.unit}</p>
        {p.sellerCount > 1 ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
            <Store className="size-3" /> Best of {p.sellerCount} stores
          </p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.bestStoreName}</p>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div className="leading-tight">
          <p className="text-sm font-semibold">{formatPaise(p.bestPricePaise)}</p>
          {off > 0 && <p className="text-xs text-muted-foreground line-through">{formatPaise(p.bestMrpPaise)}</p>}
        </div>
        <QtyStepper
          offerId={inCart?.offerId ?? p.bestOfferId}
          qty={inCart?.qty ?? 0}
          size="sm"
          className="relative z-10"
        />
      </div>
    </div>
  );
}
