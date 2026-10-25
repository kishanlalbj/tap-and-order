import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { OrderDetail } from "@/server/queries/orders";
import { StatusBadge } from "./status-badge";

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const formatTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

type SellerOrder = OrderDetail["sellerOrders"][number];

/** One store's part of an order, with replaced/refunded lines struck through. */
export function SellerOrderItems({ so, showStatus = true }: { so: SellerOrder; showStatus?: boolean }) {
  return (
    <ul className="grid gap-1.5 text-sm">
      {so.items.map((i) => (
        <li key={i.id} className={cn("flex items-center justify-between gap-2", i.status !== "ACTIVE" && "text-muted-foreground")}>
          <span className={cn("min-w-0 truncate", i.status !== "ACTIVE" && "line-through")}>
            {i.qty} × {i.productName} <span className="text-xs text-muted-foreground">({i.unit})</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {showStatus && i.status !== "ACTIVE" && <StatusBadge status={i.status} />}
            {formatPaise(i.qty * i.unitPricePaise)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EventTimeline({ events }: { events: OrderDetail["events"] }) {
  return (
    <ol className="relative grid gap-3 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
          <p>{e.message}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime(e.createdAt)}
            {e.actor ? ` · ${e.actor}` : " · system"}
          </p>
        </li>
      ))}
    </ol>
  );
}
