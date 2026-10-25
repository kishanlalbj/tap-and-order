"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSessionUser } from "@/server/authz";
import { getCart, MAX_QTY_PER_ITEM, setCartQty, clearCart } from "@/server/cart";
import { getLocation, setLocation, type DeliveryLocation } from "@/server/location";
import { offerAvailableAt, distanceFrom } from "@/server/domain/availability";
import { placeOrder } from "@/server/domain/checkout";
import { attempt, type ActionState } from "@/server/action-result";
import { DomainError } from "@/server/domain/orders";

type CartResult = { ok: true } | { ok: false; error: string; login?: boolean };

async function customerOrNull() {
  const user = await getSessionUser();
  return user?.role === "customer" ? user : null;
}

/**
 * Sets the quantity for an offer. A product can only come from one store per cart, so adding an
 * offer replaces any other store's offer for the same product (keeping the quantity).
 */
export async function setOfferQty(offerId: string, qty: number): Promise<CartResult> {
  const user = await customerOrNull();
  if (!user) return { ok: false, error: "Sign in to add items to your cart", login: true };
  if (!z.string().uuid().safeParse(offerId).success) return { ok: false, error: "Unknown item" };

  const [offer] = await db
    .select({ productId: schema.offers.productId, stock: schema.offers.stock })
    .from(schema.offers)
    .where(eq(schema.offers.id, offerId));
  if (!offer) return { ok: false, error: "This item is no longer sold" };
  if (qty > offer.stock) return { ok: false, error: `Only ${offer.stock} left at this store` };
  if (qty > MAX_QTY_PER_ITEM) return { ok: false, error: `You can order up to ${MAX_QTY_PER_ITEM} of an item` };

  const cart = await getCart(user.id);
  const otherIds = Object.keys(cart).filter((id) => id !== offerId);
  if (otherIds.length && qty > 0) {
    const siblings = await db
      .select({ id: schema.offers.id })
      .from(schema.offers)
      .where(and(inArray(schema.offers.id, otherIds), eq(schema.offers.productId, offer.productId)));
    for (const s of siblings) await setCartQty(user.id, s.id, 0);
  }
  await setCartQty(user.id, offerId, Math.max(0, qty));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Swaps a cart line to the cheapest store that can currently deliver it. */
export async function switchToBestOffer(offerId: string): Promise<CartResult> {
  const user = await customerOrNull();
  if (!user) return { ok: false, error: "Sign in first", login: true };
  const cart = await getCart(user.id);
  const qty = cart[offerId];
  if (!qty) return { ok: false, error: "Item not in cart" };

  const loc = await getLocation();
  const [current] = await db
    .select({ productId: schema.offers.productId })
    .from(schema.offers)
    .where(eq(schema.offers.id, offerId));
  const [best] = await db.execute<{ offerId: string }>(sql`
    select o.id as "offerId" from offers o join sellers s on s.id = o.seller_id
    where o.product_id = ${current.productId} and ${offerAvailableAt(loc, { minStock: qty })}
    order by o.price_paise, ${distanceFrom(loc)} limit 1
  `);
  if (!best) return { ok: false, error: "No nearby store has this in stock right now" };
  await setCartQty(user.id, offerId, 0);
  await setCartQty(user.id, best.offerId, qty);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeUnavailable(offerIds: string[]) {
  const user = await customerOrNull();
  if (!user) return;
  for (const id of offerIds) await setCartQty(user.id, id, 0);
  revalidatePath("/", "layout");
}

const locationInput = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().min(1).max(80),
  line: z.string().max(200).optional(),
  addressId: z.string().uuid().optional(),
});

export async function chooseLocation(loc: DeliveryLocation) {
  await setLocation(locationInput.parse(loc));
  revalidatePath("/", "layout");
}

export async function deleteAddress(addressId: string) {
  const user = await customerOrNull();
  if (!user) return;
  await db
    .delete(schema.addresses)
    .where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.userId, user.id)));
  revalidatePath("/", "layout");
}

const checkoutInput = z.object({
  addressLine: z.string().trim().min(5, "Add your flat / house number and street"),
  saveAddress: z.literal("on").optional(),
});

export async function checkout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let orderId = "";
  const result = await attempt(async () => {
    const user = await customerOrNull();
    if (!user) throw new DomainError("Please sign in as a customer to place orders.");
    const parsed = checkoutInput.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);

    const loc = await getLocation();
    orderId = await placeOrder({
      customerId: user.id,
      location: loc,
      addressLine: parsed.data.addressLine,
      saveAddress: parsed.data.saveAddress === "on" && !loc.addressId,
      cart: await getCart(user.id),
    });
    await clearCart(user.id);
    if (!loc.line) await setLocation({ ...loc, line: parsed.data.addressLine });
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect(`/orders/${orderId}?placed=1`);
}
