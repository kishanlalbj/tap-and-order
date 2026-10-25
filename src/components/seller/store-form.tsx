"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { updateStore } from "@/server/actions/seller";

type Props = {
  store: {
    storeName: string;
    description: string | null;
    addressLine: string;
    lat: number;
    lng: number;
    serviceRadiusKm: number;
    opensAt: string;
    closesAt: string;
  };
};

export function StoreForm({ store }: Props) {
  const [state, action] = useActionState(updateStore, undefined);
  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      <Field label="Store name" name="storeName" defaultValue={store.storeName} required />
      <Field label="Short description" name="description" defaultValue={store.description ?? ""} />
      <Field label="Address" name="addressLine" defaultValue={store.addressLine} required />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Latitude" name="lat" type="number" step="any" defaultValue={store.lat} required />
        <Field label="Longitude" name="lng" type="number" step="any" defaultValue={store.lng} required />
        <Field label="Delivery radius (km)" name="serviceRadiusKm" type="number" step="0.5" min={1} max={15} defaultValue={store.serviceRadiusKm} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opens at" name="opensAt" type="time" defaultValue={store.opensAt} required />
        <Field label="Closes at" name="closesAt" type="time" defaultValue={store.closesAt} required />
      </div>
      <FormError message={state?.error} />
      <SubmitButton className="w-fit" pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
