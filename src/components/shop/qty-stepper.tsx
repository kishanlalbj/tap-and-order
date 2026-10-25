"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setOfferQty } from "@/server/actions/shop";

type Props = {
  offerId: string;
  qty: number;
  size?: "sm" | "default";
  className?: string;
  addLabel?: string;
  /** Quantity to set when "Add" is pressed (e.g. carrying a quantity over from another store). */
  addQty?: number;
};

export function QtyStepper({ offerId, qty, size = "default", className, addLabel = "Add", addQty = 1 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [optimisticQty, setOptimisticQty] = useOptimistic(qty);

  const change = (next: number) =>
    startTransition(async () => {
      setOptimisticQty(next);
      const res = await setOfferQty(offerId, next);
      if (!res.ok) {
        if (res.login) {
          router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
          return;
        }
        toast.error(res.error);
      }
    });

  const h = size === "sm" ? "h-7" : "h-8";

  if (optimisticQty === 0) {
    return (
      <Button
        variant="outline"
        className={cn(h, "min-w-16 border-primary font-semibold text-primary hover:bg-primary/10", className)}
        onClick={() => change(addQty)}
        disabled={pending}
      >
        {addLabel}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        h,
        "inline-flex min-w-16 items-center justify-between rounded-lg bg-primary font-semibold text-primary-foreground",
        pending && "opacity-80",
        className,
      )}
    >
      <button
        aria-label="Decrease quantity"
        className="grid h-full w-7 place-items-center rounded-l-lg hover:bg-black/10"
        onClick={() => change(optimisticQty - 1)}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-4 text-center text-sm tabular-nums">{optimisticQty}</span>
      <button
        aria-label="Increase quantity"
        className="grid h-full w-7 place-items-center rounded-r-lg hover:bg-black/10"
        onClick={() => change(optimisticQty + 1)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
