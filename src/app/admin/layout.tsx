import { Bike, Boxes, LayoutDashboard, Receipt, Store, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { requireUser } from "@/server/authz";

const NAV = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard />, exact: true },
  { href: "/admin/orders", label: "Orders", icon: <Receipt /> },
  { href: "/admin/sellers", label: "Sellers", icon: <Store /> },
  { href: "/admin/riders", label: "Riders", icon: <Bike /> },
  { href: "/admin/catalog", label: "Catalogue", icon: <Boxes /> },
  { href: "/admin/payouts", label: "Payouts", icon: <Wallet /> },
];

export const metadata = { title: { default: "Admin", template: "%s · Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("admin");
  return (
    <DashboardShell title="Admin" home="/admin" nav={NAV} user={user}>
      <LiveRefresh channel="admin" />
      {children}
    </DashboardShell>
  );
}
