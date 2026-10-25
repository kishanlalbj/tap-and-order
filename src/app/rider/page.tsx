import { and, desc, eq, inArray } from "drizzle-orm";
import { Home, Phone, Store } from "lucide-react";
import { db, schema } from "@/db";
import { distanceM, formatDistance } from "@/lib/geo";
import { formatPaise, RIDER_BASE_PAY_PAISE } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatTime, shortId } from "@/components/shared/order-parts";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeliveredButton, PickupButton, RiderConsole } from "@/components/rider/rider-console";
import { getRiderForUser, requireUser } from "@/server/authz";
import { getOrderDetail } from "@/server/queries/orders";

export const dynamic = "force-dynamic";

export default async function RiderHome() {
  const user = await requireUser("rider");
  const rider = (await getRiderForUser(user.id))!;

  const [active] = await db
    .select()
    .from(schema.deliveries)
    .where(
      and(
        eq(schema.deliveries.riderId, rider.id),
        inArray(schema.deliveries.status, ["ASSIGNED", "PICKING", "OUT_FOR_DELIVERY"]),
      ),
    );
  const detail = active ? await getOrderDetail(active.orderId) : null;

  const recent = await db
    .select()
    .from(schema.deliveries)
    .where(and(eq(schema.deliveries.riderId, rider.id), eq(schema.deliveries.status, "DELIVERED")))
    .orderBy(desc(schema.deliveries.deliveredAt))
    .limit(10);

  const stops = detail?.sellerOrders.filter((s) => s.status !== "REJECTED" && s.status !== "CANCELLED") ?? [];
  const nextPickup = stops.find((s) => s.status !== "PICKED_UP" && s.status !== "DELIVERED");
  const target = detail
    ? nextPickup
      ? { ...nextPickup.storeLocation, label: nextPickup.storeName }
      : { ...detail.order.location, label: "customer" }
    : null;

  const loc = rider.lastLocation ? { lat: rider.lastLocation.y, lng: rider.lastLocation.x } : null;
  const todayEarnings = recent
    .filter((d) => d.deliveredAt && d.deliveredAt.toDateString() === new Date().toDateString())
    .reduce((a, d) => a + d.feePaise + RIDER_BASE_PAY_PAISE, 0);

  return (
    <div className="grid gap-4">
      <RiderConsole status={rider.status} initialLocation={loc} target={target} />

      {detail && active && (
        <section className="grid gap-3 rounded-2xl border-2 border-primary bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Order #{shortId(detail.order.id)}</h2>
            <StatusBadge status={active.status} />
          </div>

          <ol className="grid gap-3">
            {stops.map((so, i) => {
              const done = so.status === "PICKED_UP" || so.status === "DELIVERED";
              return (
                <li key={so.id} className={cn("grid gap-2 rounded-xl border p-3", done && "bg-muted/50 opacity-70")}>
                  <div className="flex items-start gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Store className="size-3.5" /> Pick up · {so.storeName}
                      </p>
                      <p className="text-xs text-muted-foreground">{so.storeAddress}</p>
                      {loc && (
                        <p className="text-xs text-muted-foreground">{formatDistance(distanceM(loc, so.storeLocation))} away</p>
                      )}
                    </div>
                    <StatusBadge status={so.status} />
                  </div>
                  <ul className="ml-8 text-xs text-muted-foreground">
                    {so.items
                      .filter((it) => it.status === "ACTIVE")
                      .map((it) => (
                        <li key={it.id}>
                          {it.qty} × {it.productName}
                        </li>
                      ))}
                  </ul>
                  {!done && (
                    <div className="ml-8">
                      <PickupButton sellerOrderId={so.id} ready={so.status === "PACKED"} />
                    </div>
                  )}
                </li>
              );
            })}

            <li className="grid gap-3 rounded-xl border bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  <Home className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Drop · {detail.customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.order.addressLine}, {detail.order.addressLabel}
                  </p>
                  {detail.customer.phone && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3" /> {detail.customer.phone}
                    </p>
                  )}
                </div>
              </div>
              <DeliveredButton deliveryId={active.id} ready={active.status === "OUT_FOR_DELIVERY"} />
            </li>
          </ol>
        </section>
      )}

      <section className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Recent deliveries</h2>
          <span className="text-xs text-muted-foreground">Today: {formatPaise(todayEarnings)} earned</span>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>#{shortId(d.orderId)}</span>
                <span className="text-xs text-muted-foreground">{d.deliveredAt && formatTime(d.deliveredAt)}</span>
                <span className="font-medium">{formatPaise(d.feePaise + RIDER_BASE_PAY_PAISE)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Payout per drop = {formatPaise(RIDER_BASE_PAY_PAISE)} base + the customer&apos;s delivery fee.</p>
      </section>
    </div>
  );
}
