import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  PLACED: "bg-sky-100 text-sky-800",
  PENDING: "bg-amber-100 text-amber-800",
  SEARCHING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  ACCEPTED: "bg-indigo-100 text-indigo-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  PACKED: "bg-violet-100 text-violet-800",
  PICKING: "bg-violet-100 text-violet-800",
  PICKED_UP: "bg-fuchsia-100 text-fuchsia-800",
  OUT_FOR_DELIVERY: "bg-fuchsia-100 text-fuchsia-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  PAID: "bg-emerald-100 text-emerald-800",
  ONLINE: "bg-emerald-100 text-emerald-800",
  BUSY: "bg-violet-100 text-violet-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  SUSPENDED: "bg-rose-100 text-rose-800",
  REFUNDED: "bg-rose-100 text-rose-800",
  REASSIGNED: "bg-zinc-100 text-zinc-700",
  PARTIALLY_REFUNDED: "bg-orange-100 text-orange-800",
  OFFLINE: "bg-zinc-100 text-zinc-700",
};

export const humanize = (status: string) =>
  status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {humanize(status)}
    </span>
  );
}
