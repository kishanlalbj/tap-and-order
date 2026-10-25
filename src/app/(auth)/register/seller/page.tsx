import { AuthSwitch, SellerRegisterForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Become a selling partner" };

export default function SellerRegisterPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Become a selling partner</h1>
        <p className="text-sm text-muted-foreground">
          List your store&apos;s products, set your own prices, and we handle delivery. Applications are reviewed by
          our team before your store goes live.
        </p>
      </div>
      <SellerRegisterForm />
      <AuthSwitch text="Already registered?" href="/login" cta="Sign in" />
    </div>
  );
}
