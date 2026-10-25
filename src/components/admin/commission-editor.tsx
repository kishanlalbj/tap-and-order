"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSellerCommission } from "@/server/actions/admin";

export function CommissionEditor({ sellerId, percent }: { sellerId: string; percent: number }) {
  const [value, setValue] = useState(String(percent));
  const [pending, start] = useTransition();
  const dirty = Number(value) !== percent;
  return (
    <div className="flex items-center gap-1">
      <Input className="h-7 w-16" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" aria-label="Commission %" />
      <span className="text-xs text-muted-foreground">%</span>
      {dirty && (
        <Button
          size="xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setSellerCommission(sellerId, Number(value));
              if (res.error) toast.error(res.error);
              else toast.success("Commission updated for future orders");
            })
          }
        >
          Save
        </Button>
      )}
    </div>
  );
}
