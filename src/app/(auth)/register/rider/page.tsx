import { AuthSwitch, RiderRegisterForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Become a delivery partner" };

export default function RiderRegisterPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Become a delivery partner</h1>
        <p className="text-sm text-muted-foreground">Pick up from local stores and deliver nearby. Flexible hours.</p>
      </div>
      <RiderRegisterForm />
      <AuthSwitch text="Already registered?" href="/login" cta="Sign in" />
    </div>
  );
}
