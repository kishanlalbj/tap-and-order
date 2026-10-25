import { redirect } from "next/navigation";
import { LayoutDashboard, PackagePlus, Settings, Tags, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { AcceptingToggle } from "@/components/seller/seller-controls";
import { getSellerForUser, requireUser } from "@/server/authz";

const NAV = [
  { href: "/seller", label: "Orders", icon: <LayoutDashboard />, exact: true },
  { href: "/seller/offers", label: "My listings", icon: <Tags />, exact: true },
  { href: "/seller/offers/new", label: "Add products", icon: <PackagePlus /> },
  { href: "/seller/earnings", label: "Earnings", icon: <Wallet /> },
  { href: "/seller/profile", label: "Store settings", icon: <Settings /> },
];

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("seller");
  const seller = await getSellerForUser(user.id);
  if (!seller) redirect("/register/seller");
  const approved = seller.status === "APPROVED";

  return (
    <DashboardShell
      title="Seller"
      home="/seller"
      nav={approved ? NAV : NAV.filter((n) => n.href === "/seller" || n.href === "/seller/profile")}
      user={user}
      headerExtra={approved && <AcceptingToggle accepting={seller.isAcceptingOrders} />}
    >
      {approved && (
        <LiveRefresh
          channel={`seller:${seller.id}`}
          toastOn={{ "seller.new": "🛎️ New order received!" }}
        />
      )}
      {children}
    </DashboardShell>
  );
}
