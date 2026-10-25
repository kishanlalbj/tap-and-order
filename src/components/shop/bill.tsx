import { formatPaise } from "@/lib/money";

type Props = {
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  savingsPaise?: number;
  refundedPaise?: number;
};

export function Bill({ subtotalPaise, deliveryFeePaise, totalPaise, savingsPaise, refundedPaise }: Props) {
  return (
    <dl className="grid gap-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Items total</dt>
        <dd>{formatPaise(subtotalPaise)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Delivery fee</dt>
        <dd>{deliveryFeePaise === 0 ? <span className="text-emerald-700">FREE</span> : formatPaise(deliveryFeePaise)}</dd>
      </div>
      <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd>{formatPaise(totalPaise)}</dd>
      </div>
      {!!refundedPaise && (
        <div className="flex justify-between text-orange-700">
          <dt>Refunded</dt>
          <dd>−{formatPaise(refundedPaise)}</dd>
        </div>
      )}
      {!!savingsPaise && savingsPaise > 0 && (
        <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-center text-xs font-medium text-emerald-800">
          You&apos;re saving {formatPaise(savingsPaise)} on MRP
        </p>
      )}
    </dl>
  );
}
