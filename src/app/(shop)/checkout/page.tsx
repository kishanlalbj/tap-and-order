import { redirect } from "next/navigation";
import { MapPin, Store } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { Bill } from "@/components/shop/bill";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { requireUser } from "@/server/authz";
import { getCartDetails } from "@/server/cart";
import { getLocation } from "@/server/location";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("customer");
  const loc = await getLocation();
  const cart = await getCartDetails(user.id, loc);
  if (!cart || cart.lines.length === 0 || cart.hasProblems) redirect("/cart");

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
      <section className="grid content-start gap-5 rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-semibold">Checkout</h1>
        <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
          <MapPin className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-medium">{loc.label}</p>
            <p className="text-xs text-muted-foreground">
              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}. Change it from &ldquo;Deliver to&rdquo; at the top.
            </p>
          </div>
        </div>
        <CheckoutForm defaultLine={loc.line} isSavedAddress={!!loc.addressId} totalLabel={formatPaise(cart.totalPaise)} />
      </section>

      <aside className="grid h-fit gap-4 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="grid gap-3 text-sm">
          {cart.groups.map((g) => (
            <li key={g.sellerId} className="grid gap-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Store className="size-3.5" /> {g.storeName}
              </p>
              {g.items.map((l) => (
                <p key={l.offerId} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.qty} × {l.name}
                  </span>
                  <span className="shrink-0">{formatPaise(l.pricePaise * l.qty)}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
        <Bill {...cart} />
      </aside>
    </div>
  );
}
