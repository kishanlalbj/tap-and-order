import { Hourglass } from "lucide-react";
import { AccountMenu } from "@/components/shared/account-menu";
import { Logo } from "@/components/shared/logo";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { getRiderForUser, requireUser } from "@/server/authz";

export const metadata = { title: "Rider" };

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("rider");
  const rider = await getRiderForUser(user.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-2.5">
        <Logo href="/rider" suffix="Rider" />
        <AccountMenu name={user.name ?? ""} email={user.email ?? ""} links={[]} />
      </header>
      <main className="flex-1 p-4">
        {rider?.approval === "APPROVED" ? (
          <>
            <LiveRefresh channel={`rider:${rider.id}`} toastOn={{ "rider.assigned": "🛵 New delivery assigned!" }} />
            {children}
          </>
        ) : (
          <div className="mt-10 grid gap-3 rounded-2xl border bg-card p-6 text-center">
            <Hourglass className="mx-auto size-10 text-amber-500" />
            <h1 className="text-lg font-semibold">
              {rider?.approval === "SUSPENDED" ? "Your account is suspended" : "Application under review"}
            </h1>
            <p className="text-sm text-muted-foreground">
              We verify documents for every delivery partner. You can go online once you&apos;re approved.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
