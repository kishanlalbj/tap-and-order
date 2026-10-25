import { AuthSwitch, LoginForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Sign in" };

const DEMO = [
  ["Customer", "asha@tap.dev"],
  ["Seller", "dailyneeds@tap.dev"],
  ["Rider", "rider1@tap.dev"],
  ["Admin", "admin@tap.dev"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const next = callbackUrl ? new URL(callbackUrl, "http://x").pathname : undefined;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to shop, sell or deliver.</p>
      </div>
      <LoginForm next={next} />
      <AuthSwitch text="New here?" href="/register" cta="Create an account" />
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Demo accounts (password: password123)</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {DEMO.map(([role, email]) => (
              <li key={email}>
                {role}: <span className="font-mono">{email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
