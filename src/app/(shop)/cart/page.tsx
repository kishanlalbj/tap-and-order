import Link from "next/link";
import { AlertTriangle, ShoppingBasket, Store, Truck } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Bill } from "@/components/shop/bill";
import { RemoveItemsButton, SwitchToBestButton } from "@/components/shop/cart-actions";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { requireUser } from "@/server/authz";
import { getCartDetails } from "@/server/cart";
import { getLocation } from "@/server/location";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await requireUser("customer");
  const loc = await getLocation();
  const cart = await getCartDetails(user.id, loc);

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
        <ShoppingBasket className="size-12 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground">We&apos;ll find you the best price nearby for everything you add.</p>
        <Link href="/" className={buttonVariants()}>
          Start shopping
        </Link>
      </div>
    );
  }

  const unavailable = cart.lines.filter((l) => l.problem === "unavailable").map((l) => l.offerId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">Your cart</h1>
          <p className="text-sm text-muted-foreground">
            {cart.groups.length > 1
              ? `From ${cart.groups.length} stores, picked up by one rider and delivered together to ${loc.label}.`
              : `Delivering to ${loc.label}.`}
          </p>
        </div>

        {unavailable.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="size-5 shrink-0" />
            <p className="flex-1">Some items can&apos;t be delivered to {loc.label} from their store.</p>
            <RemoveItemsButton offerIds={unavailable} label="Remove them" />
          </div>
        )}

        {cart.groups.map((g) => (
          <section key={g.sellerId} className="rounded-2xl border bg-card">
            <header className="flex items-center gap-2 border-b px-4 py-2.5">
              <Store className="size-4 text-primary" />
              <span className="font-medium">{g.storeName}</span>
              <span className="text-xs text-muted-foreground">· {formatDistance(g.distanceM)} away</span>
            </header>
            <ul className="divide-y">
              {g.items.map((l) => {
                const cheaper = !l.problem && l.bestPricePaise !== null && l.bestPricePaise < l.pricePaise;
                return (
                  <li key={l.offerId} className={cn("flex gap-3 px-4 py-3", l.problem === "unavailable" && "opacity-60")}>
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-2xl">{l.icon}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${l.productId}`} className="line-clamp-1 text-sm font-medium hover:underline">
                        {l.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{l.unit}</p>
                      {l.problem === "unavailable" && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-rose-700">
                          Not available from this store right now
                          <SwitchToBestButton offerId={l.offerId} label="Find another store" />
                        </div>
                      )}
                      {l.problem === "low-stock" && (
                        <p className="mt-1 text-xs text-rose-700">Only {l.stock} left. Reduce the quantity.</p>
                      )}
                      {cheaper && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                          {formatPaise(l.pricePaise - l.bestPricePaise!)} cheaper at another store
                          <SwitchToBestButton offerId={l.offerId} label="Switch & save" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <QtyStepper offerId={l.offerId} qty={l.qty} size="sm" />
                      <span className="text-sm font-semibold">{formatPaise(l.pricePaise * l.qty)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <aside className="grid h-fit gap-4 rounded-2xl border bg-card p-4 lg:sticky lg:top-20">
        {cart.freeDeliveryGapPaise > 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
            <Truck className="size-4 text-primary" /> Add {formatPaise(cart.freeDeliveryGapPaise)} more for free delivery
          </p>
        )}
        <Bill {...cart} />
        {cart.hasProblems ? (
          <p className="text-center text-xs text-rose-700">Fix the highlighted items to continue</p>
        ) : (
          <Link href="/checkout" className={buttonVariants({ size: "lg", className: "h-11 text-base" })}>
            Proceed to checkout
          </Link>
        )}
      </aside>
    </div>
  );
}
