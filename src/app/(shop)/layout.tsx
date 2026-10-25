import Link from "next/link";
import { eq } from "drizzle-orm";
import { Search, ShoppingCart } from "lucide-react";
import { db, schema } from "@/db";
import { fromPoint } from "@/lib/geo";
import { formatPaise } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { AccountMenu } from "@/components/shared/account-menu";
import { Logo } from "@/components/shared/logo";
import { LocationPicker } from "@/components/shop/location-picker";
import { getSessionUser } from "@/server/authz";
import { getCartDetails } from "@/server/cart";
import { getLocation } from "@/server/location";

const ROLE_LINKS = {
  customer: [
    { href: "/orders", label: "My orders" },
    { href: "/cart", label: "Cart" },
  ],
  seller: [{ href: "/seller", label: "Seller dashboard" }],
  rider: [{ href: "/rider", label: "Rider app" }],
  admin: [{ href: "/admin", label: "Admin console" }],
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [user, loc] = await Promise.all([getSessionUser(), getLocation()]);
  const isCustomer = user?.role === "customer";

  const [saved, cart] = isCustomer
    ? await Promise.all([
        db.select().from(schema.addresses).where(eq(schema.addresses.userId, user.id)),
        getCartDetails(user.id, loc),
      ])
    : [[], null];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-4">
          <Logo className="hidden shrink-0 sm:flex" />
          <LocationPicker
            current={loc}
            saved={saved.map((a) => ({ id: a.id, label: a.label, line: a.line, ...fromPoint(a.location) }))}
          />
          <form action="/search" className="relative ml-auto hidden flex-1 md:block md:max-w-md">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search milk, chips, atta…"
              className="h-9 w-full rounded-lg border bg-muted/50 pr-3 pl-9 text-sm outline-none focus:border-ring focus:bg-background"
            />
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link href="/search" className={buttonVariants({ variant: "ghost", size: "icon", className: "md:hidden" })}>
              <Search />
            </Link>
            {user ? (
              <AccountMenu name={user.name ?? ""} email={user.email ?? ""} links={ROLE_LINKS[user.role]} />
            ) : (
              <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
                Sign in
              </Link>
            )}
            {isCustomer && (
              <Link href="/cart" className={buttonVariants({ className: "h-9 gap-2 px-3" })}>
                <ShoppingCart />
                {cart && cart.itemCount > 0 ? (
                  <span className="text-left text-xs leading-tight">
                    <span className="block font-semibold">{cart.itemCount} items</span>
                    <span className="block">{formatPaise(cart.subtotalPaise)}</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline">Cart</span>
                )}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          <span>© Tap&amp;Order</span>
          <Link href="/register/seller" className="hover:text-foreground">
            Sell with us
          </Link>
          <Link href="/register/rider" className="hover:text-foreground">
            Deliver with us
          </Link>
        </div>
      </footer>
    </div>
  );
}
