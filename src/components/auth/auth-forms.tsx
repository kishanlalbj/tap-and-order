"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Field, FormError, selectClass } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { BENGALURU_AREAS } from "@/lib/geo";
import { login, registerCustomer, registerRider, registerSeller } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError message={state?.error} />
      <SubmitButton size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

function UserFields() {
  return (
    <>
      <Field label="Full name" name="name" autoComplete="name" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone" name="phone" inputMode="numeric" placeholder="10 digits" required />
      </div>
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
    </>
  );
}

export function CustomerRegisterForm() {
  const [state, action] = useActionState(registerCustomer, undefined);
  return (
    <form action={action} className="grid gap-4">
      <UserFields />
      <FormError message={state?.error} />
      <SubmitButton size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function SellerRegisterForm() {
  const [state, action] = useActionState(registerSeller, undefined);
  const [area, setArea] = useState(BENGALURU_AREAS[0]);
  return (
    <form action={action} className="grid gap-4">
      <UserFields />
      <hr className="my-1" />
      <Field label="Store name" name="storeName" required />
      <Field label="Store address" name="addressLine" placeholder="Shop no, street, locality" required />
      <div className="grid gap-1.5">
        <Label htmlFor="area">Store location</Label>
        <select
          id="area"
          className={selectClass}
          value={area.label}
          onChange={(e) => setArea(BENGALURU_AREAS.find((a) => a.label === e.target.value)!)}
        >
          {BENGALURU_AREAS.map((a) => (
            <option key={a.label}>{a.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Pick the nearest area, then fine-tune the coordinates.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Latitude" name="lat" key={`lat-${area.label}`} defaultValue={area.lat} step="any" type="number" required />
        <Field label="Longitude" name="lng" key={`lng-${area.label}`} defaultValue={area.lng} step="any" type="number" required />
        <Field label="Delivers within (km)" name="serviceRadiusKm" defaultValue={5} type="number" min={1} max={15} required />
      </div>
      <FormError message={state?.error} />
      <SubmitButton size="lg" pendingText="Submitting…">
        Apply as a selling partner
      </SubmitButton>
    </form>
  );
}

export function RiderRegisterForm() {
  const [state, action] = useActionState(registerRider, undefined);
  return (
    <form action={action} className="grid gap-4">
      <UserFields />
      <div className="grid gap-1.5">
        <Label htmlFor="vehicle">Vehicle</Label>
        <select id="vehicle" name="vehicle" className={selectClass} defaultValue="bike">
          <option value="bike">Motorbike</option>
          <option value="scooter">Scooter</option>
          <option value="bicycle">Bicycle</option>
        </select>
      </div>
      <FormError message={state?.error} />
      <SubmitButton size="lg" pendingText="Submitting…">
        Apply as a delivery partner
      </SubmitButton>
    </form>
  );
}

export function AuthSwitch({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {text}{" "}
      <Link href={href} className="font-medium text-primary hover:underline">
        {cta}
      </Link>
    </p>
  );
}
