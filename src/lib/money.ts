const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatPaise = (paise: number) => inr.format(paise / 100);

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

export const commissionFor = (subtotalPaise: number, bps: number) =>
  Math.round((subtotalPaise * bps) / 10_000);

export const DELIVERY_FEE_PAISE = 2500;
export const FREE_DELIVERY_ABOVE_PAISE = 19900;

export const deliveryFeeFor = (subtotalPaise: number) =>
  subtotalPaise >= FREE_DELIVERY_ABOVE_PAISE ? 0 : DELIVERY_FEE_PAISE;

/** What a rider earns per drop on top of the delivery fee the customer paid. */
export const RIDER_BASE_PAY_PAISE = 2000;
