import Link from "next/link";
import { Bike, Store } from "lucide-react";
import { AuthSwitch, CustomerRegisterForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">Groceries from the cheapest store near you, in minutes.</p>
      </div>
      <CustomerRegisterForm />
      <AuthSwitch text="Already have an account?" href="/login" cta="Sign in" />
      <div className="grid gap-2 border-t pt-5 sm:grid-cols-2">
        <Link href="/register/seller" className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted">
          <Store className="size-4 text-primary" /> Sell on Tap&amp;Order
        </Link>
        <Link href="/register/rider" className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted">
          <Bike className="size-4 text-primary" /> Deliver with us
        </Link>
      </div>
    </div>
  );
}
