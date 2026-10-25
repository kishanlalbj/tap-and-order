"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, selectClass } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { requestProduct, upsertOffer } from "@/server/actions/seller";

type Props = { productId: string; listed: boolean; suggestedMrp?: number; marketMin?: number };

export function AddOfferForm({ productId, listed, suggestedMrp, marketMin }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(upsertOffer, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" variant={listed ? "outline" : "default"} onClick={() => setOpen(true)}>
        {listed ? "Update" : "List it"}
      </Button>
    );
  }

  return (
    <form action={action} className="flex w-full flex-wrap items-end gap-2 rounded-lg bg-muted/60 p-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="grid gap-1 text-xs">
        Your price (₹)
        <Input name="price" inputMode="decimal" className="h-8 w-24 bg-background" defaultValue={marketMin} required />
      </label>
      <label className="grid gap-1 text-xs">
        MRP (₹)
        <Input name="mrp" inputMode="decimal" className="h-8 w-24 bg-background" defaultValue={suggestedMrp} required />
      </label>
      <label className="grid gap-1 text-xs">
        Stock
        <Input name="stock" inputMode="numeric" className="h-8 w-20 bg-background" defaultValue={20} required />
      </label>
      <SubmitButton size="sm" pendingText="Saving…">
        Save
      </SubmitButton>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <div className="w-full">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function RequestProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, action] = useActionState(requestProduct, undefined);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form key={key} action={action} className="grid gap-3">
      <Field label="Product name" name="name" placeholder="e.g. Organic Jaggery Powder" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand" name="brand" placeholder="Optional" />
        <Field label="Pack size" name="unit" placeholder="500 g" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <select id="categoryId" name="categoryId" className={selectClass}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Field label="Note for reviewer" name="note" placeholder="Optional" />
      <FormError message={state?.error} />
      <SubmitButton variant="outline" pendingText="Sending…">
        Request product
      </SubmitButton>
    </form>
  );
}
