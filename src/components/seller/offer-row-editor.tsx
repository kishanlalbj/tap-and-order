"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { quickUpdateOffer } from "@/server/actions/seller";

type Props = { offerId: string; price: number; stock: number; active: boolean; suggestedPrice?: number };

/** Inline price / stock / visibility editing for one listing. */
export function OfferRowEditor({ offerId, price, stock, active, suggestedPrice }: Props) {
  const [pending, start] = useTransition();
  const [values, setValues] = useState({ price: String(price), stock: String(stock) });
  const dirty = Number(values.price) !== price || Number(values.stock) !== stock;

  const save = (patch: Parameters<typeof quickUpdateOffer>[1], msg = "Listing updated") =>
    start(async () => {
      const res = await quickUpdateOffer(offerId, patch);
      if (res.error) toast.error(res.error);
      else toast.success(msg);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        ₹
        <Input
          className="h-7 w-20"
          inputMode="decimal"
          value={values.price}
          onChange={(e) => setValues({ ...values, price: e.target.value })}
          aria-label="Price"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Stock
        <Input
          className="h-7 w-16"
          inputMode="numeric"
          value={values.stock}
          onChange={(e) => setValues({ ...values, stock: e.target.value })}
          aria-label="Stock"
        />
      </label>
      {dirty && (
        <Button size="sm" disabled={pending} onClick={() => save({ price: Number(values.price), stock: Number(values.stock) })}>
          Save
        </Button>
      )}
      {suggestedPrice !== undefined && !dirty && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setValues({ ...values, price: String(suggestedPrice) });
            save({ price: suggestedPrice }, `Price matched at ₹${suggestedPrice}`);
          }}
        >
          Match ₹{suggestedPrice}
        </Button>
      )}
      <Switch
        checked={active}
        disabled={pending}
        onCheckedChange={(v) => save({ active: v }, v ? "Listing is live" : "Listing hidden")}
        aria-label="Listing visible"
      />
    </div>
  );
}
