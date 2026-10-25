"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { acceptOrder, packOrder, rejectOrder, setAcceptingOrders } from "@/server/actions/seller";

export function AcceptingToggle({ accepting }: { accepting: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm">
      <Switch
        checked={accepting}
        disabled={pending}
        onCheckedChange={(v) =>
          start(async () => {
            await setAcceptingOrders(v);
            toast(v ? "Store is open for orders" : "Store paused. You won't get new orders.");
          })
        }
      />
      <span className={cn("font-medium", accepting ? "text-emerald-700" : "text-muted-foreground")}>
        {accepting ? "Accepting orders" : "Paused"}
      </span>
    </label>
  );
}

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={cn("font-mono text-xs tabular-nums", left < 30 ? "text-rose-600" : "text-amber-700")}>
      {left === 0 ? "expiring…" : `${mm}:${ss} to accept`}
    </span>
  );
}

function useOrderAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });
  return { pending, run };
}

export function PendingActions({ id }: { id: string }) {
  const { pending, run } = useOrderAction();
  return (
    <div className="flex gap-2">
      <Button className="flex-1" disabled={pending} onClick={() => run(() => acceptOrder(id), "Order accepted. Start packing!")}>
        <Check /> Accept
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (confirm("Reject this order? The items will be offered to another store.")) {
            run(() => rejectOrder(id), "Order rejected");
          }
        }}
      >
        <X /> Reject
      </Button>
    </div>
  );
}

export function PackAction({ id }: { id: string }) {
  const { pending, run } = useOrderAction();
  return (
    <Button className="w-full" disabled={pending} onClick={() => run(() => packOrder(id), "Marked as packed")}>
      <PackageCheck /> Mark packed
    </Button>
  );
}
