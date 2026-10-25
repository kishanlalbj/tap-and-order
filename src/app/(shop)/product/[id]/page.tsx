import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Trophy } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { NotServiceable } from "@/components/shop/catalog";
import { discountPct, ProductImage } from "@/components/shop/product-card";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { getSessionUser } from "@/server/authz";
import { getCartByProduct } from "@/server/cart";
import { getLocation } from "@/server/location";
import { getOffersForProduct, getProduct } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [loc, user, data] = await Promise.all([getLocation(), getSessionUser(), getProduct(id)]);
  if (!data || !data.product.active) notFound();
  const { product, category } = data;

  const [offers, cart] = await Promise.all([
    getOffersForProduct(id, loc),
    user?.role === "customer" ? getCartByProduct(user.id) : {},
  ]);
  const inCart = (cart as Record<string, { offerId: string; qty: number }>)[id];
  const best = offers[0];
  const highest = offers.at(-1);

  return (
    <div className="grid gap-6">
      <Link href={`/category/${category.slug}`} className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {category.name}
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,380px)_1fr]">
        <ProductImage icon={category.icon} imageUrl={product.imageUrl} className="[&>span]:text-8xl" />

        <div className="grid content-start gap-5">
          <div>
            {product.brand && <p className="text-sm font-medium text-primary">{product.brand}</p>}
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">{product.unit}</p>
          </div>

          {!best ? (
            <NotServiceable label={loc.label} />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-bold">{formatPaise(best.pricePaise)}</span>
                {best.mrpPaise > best.pricePaise && (
                  <>
                    <span className="text-muted-foreground line-through">MRP {formatPaise(best.mrpPaise)}</span>
                    <span className="rounded-md bg-sky-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      {discountPct(best.pricePaise, best.mrpPaise)}% OFF
                    </span>
                  </>
                )}
              </div>
              {highest && highest.pricePaise > best.pricePaise && (
                <p className="text-sm text-emerald-700">
                  You save {formatPaise(highest.pricePaise - best.pricePaise)} compared to the priciest store nearby.
                </p>
              )}

              <section className="grid gap-2">
                <h2 className="text-sm font-semibold">
                  {offers.length} {offers.length === 1 ? "store sells" : "stores sell"} this near {loc.label}
                </h2>
                <ul className="grid gap-2">
                  {offers.map((o, i) => {
                    const selected = inCart?.offerId === o.offerId;
                    return (
                      <li
                        key={o.offerId}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border bg-card p-3",
                          i === 0 && "border-amber-300 bg-amber-50/60",
                          selected && "ring-2 ring-primary",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-medium">
                            {o.storeName}
                            {i === 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 uppercase">
                                <Trophy className="size-3" /> Best price
                              </span>
                            )}
                          </p>
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="size-3" /> {formatDistance(o.distanceM)} away
                            </span>
                            <span>{o.stock < 10 ? `Only ${o.stock} left` : "In stock"}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPaise(o.pricePaise)}</p>
                          {i > 0 && (
                            <p className="text-xs text-rose-600">+{formatPaise(o.pricePaise - best.pricePaise)}</p>
                          )}
                        </div>
                        <QtyStepper
                          offerId={o.offerId}
                          qty={selected ? inCart.qty : 0}
                          addLabel={inCart && !selected ? "Switch" : "Add"}
                          addQty={inCart && !selected ? inCart.qty : 1}
                        />
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Your cart holds each product from one store. Choosing another store moves your quantity there.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
