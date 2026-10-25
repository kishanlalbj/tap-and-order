"use client";

import { useActionState } from "react";
import { CreditCard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { checkout } from "@/server/actions/shop";

type Props = { defaultLine?: string; isSavedAddress: boolean; totalLabel: string };

export function CheckoutForm({ defaultLine, isSavedAddress, totalLabel }: Props) {
  const [state, action] = useActionState(checkout, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="addressLine">Flat / house no., building, street</Label>
        <Textarea
          id="addressLine"
          name="addressLine"
          defaultValue={defaultLine}
          placeholder="e.g. Flat 302, Green Residency, 5th Cross"
          rows={2}
          required
        />
      </div>
      {!isSavedAddress && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="saveAddress" defaultChecked className="size-4 accent-[var(--primary)]" />
          Save this address for next time
        </label>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <CreditCard className="size-4" /> Payments are simulated in this demo. Your order is marked paid right away.
      </div>
      <FormError message={state?.error} />
      <SubmitButton size="lg" className="h-11 text-base" pendingText="Placing order…">
        Pay {totalLabel} &amp; place order
      </SubmitButton>
    </form>
  );
}
