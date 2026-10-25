import { Check, ChefHat, PackageCheck, ShoppingBag, Bike, Home, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { status: "PLACED", label: "Placed", icon: ShoppingBag },
  { status: "CONFIRMED", label: "Confirmed", icon: ChefHat },
  { status: "PACKED", label: "Packed", icon: PackageCheck },
  { status: "OUT_FOR_DELIVERY", label: "On the way", icon: Bike },
  { status: "DELIVERED", label: "Delivered", icon: Home },
] as const;

export function OrderProgress({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">
        <XCircle className="size-5" /> This order was cancelled and fully refunded.
      </div>
    );
  }
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((step, i) => {
        const done = i < current || status === "DELIVERED";
        const active = i === current && status !== "DELIVERED";
        const Icon = done ? Check : step.icon;
        return (
          <li key={step.status} className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : i <= current ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border-2",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "animate-pulse border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span
                className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "invisible" : i < current ? "bg-primary" : "bg-border")}
              />
            </div>
            <span className={cn("text-[11px] leading-tight sm:text-xs", (done || active) ? "font-medium" : "text-muted-foreground")}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
