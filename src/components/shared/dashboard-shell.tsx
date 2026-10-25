import { Logo } from "./logo";
import { AccountMenu } from "./account-menu";
import { NavLink } from "./nav-link";

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

type Props = {
  title: string;
  home: string;
  nav: NavItem[];
  user: { name?: string | null; email?: string | null };
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ title, home, nav, user, headerExtra, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Logo href={home} suffix={title} />
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <AccountMenu name={user.name ?? ""} email={user.email ?? ""} links={[{ href: "/", label: "Open storefront" }]} />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-1.5 md:hidden">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact} compact>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-background p-3 md:block">
          <nav className="sticky top-16 grid gap-0.5">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact}>
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
