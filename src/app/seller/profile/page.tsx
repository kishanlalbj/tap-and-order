import { fromPoint } from "@/lib/geo";
import { PageHeader } from "@/components/shared/dashboard-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { StoreForm } from "@/components/seller/store-form";
import { requireSeller } from "@/server/authz";

export const metadata = { title: "Store settings" };

export default async function StoreSettingsPage() {
  const { seller } = await requireSeller({ approved: false });
  const loc = fromPoint(seller.location);
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Store settings"
        description="Customers inside your delivery radius see your listings while you're open."
        action={<StatusBadge status={seller.status} />}
      />
      <div className="rounded-xl border bg-card p-5">
        <StoreForm
          store={{
            storeName: seller.storeName,
            description: seller.description,
            addressLine: seller.addressLine,
            ...loc,
            serviceRadiusKm: seller.serviceRadiusM / 1000,
            opensAt: seller.opensAt.slice(0, 5),
            closesAt: seller.closesAt.slice(0, 5),
          }}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Platform commission: {seller.commissionBps / 100}% of each delivered order&apos;s items total.
        </p>
      </div>
    </div>
  );
}
