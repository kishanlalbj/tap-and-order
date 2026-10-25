"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Field, FormError, selectClass } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { createProduct } from "@/server/actions/admin";

export function ProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, action] = useActionState(createProduct, undefined);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form key={key} action={action} className="grid gap-3">
      <Field label="Name" name="name" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand" name="brand" />
        <Field label="Pack size" name="unit" placeholder="1 kg" required />
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
      <Field label="Image URL" name="imageUrl" placeholder="Optional" />
      <FormError message={state?.error} />
      <SubmitButton pendingText="Adding…">Add product</SubmitButton>
    </form>
  );
}
