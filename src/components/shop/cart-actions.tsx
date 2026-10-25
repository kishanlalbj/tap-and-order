"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeUnavailable, switchToBestOffer } from "@/server/actions/shop";

export function SwitchToBestButton({ offerId, label }: { offerId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await switchToBestOffer(offerId);
          if (!res.ok) toast.error(res.error);
          else toast.success("Switched to the cheapest store");
        })
      }
    >
      {label}
    </Button>
  );
}

export function RemoveItemsButton({ offerIds, label }: { offerIds: string[]; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="xs" variant="ghost" disabled={pending} onClick={() => start(() => removeUnavailable(offerIds))}>
      {label}
    </Button>
  );
}
