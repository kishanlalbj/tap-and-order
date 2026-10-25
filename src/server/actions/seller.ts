"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { invalidateCatalog } from "@/lib/cache";
import { toPoint } from "@/lib/geo";
import { rupeesToPaise } from "@/lib/money";
import { assertApprovedSeller, assertRole, getSellerForUser } from "@/server/authz";
import { attempt, type ActionState } from "@/server/action-result";
import {
  acceptSellerOrder,
  DomainError,
  packSellerOrder,
  rejectSellerOrder,
} from "@/server/domain/orders";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

const storeSchema = z
  .object({
    storeName: z.string().trim().min(3),
    description: z.string().trim().max(300).optional(),
    addressLine: z.string().trim().min(5),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    serviceRadiusKm: z.coerce.number().min(1).max(15),
    opensAt: time,
    closesAt: time,
  })
  .refine((d) => d.opensAt < d.closesAt, { message: "Closing time must be after opening time" });

export async function updateStore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertRole("seller");
    const seller = await getSellerForUser(user.id);
    if (!seller) throw new DomainError("Store not found");
    const parsed = storeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    const d = parsed.data;
    await db
      .update(schema.sellers)
      .set({
        storeName: d.storeName,
        description: d.description || null,
        addressLine: d.addressLine,
        location: toPoint(d),
        serviceRadiusM: Math.round(d.serviceRadiusKm * 1000),
        opensAt: d.opensAt,
        closesAt: d.closesAt,
      })
      .where(eq(schema.sellers.id, seller.id));
    await invalidateCatalog();
    revalidatePath("/seller", "layout");
    return "Store details saved";
  });
}

export async function setAcceptingOrders(accepting: boolean) {
  const { seller } = await assertApprovedSeller();
  await db.update(schema.sellers).set({ isAcceptingOrders: accepting }).where(eq(schema.sellers.id, seller.id));
  await invalidateCatalog();
  revalidatePath("/seller", "layout");
}

const offerSchema = z
  .object({
    productId: z.string().uuid(),
    price: z.coerce.number().positive("Price must be above zero"),
    mrp: z.coerce.number().positive("MRP must be above zero"),
    stock: z.coerce.number().int().min(0).max(10_000),
  })
  .refine((d) => d.price <= d.mrp, { message: "Selling price can't be above MRP" });

export async function upsertOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const { seller } = await assertApprovedSeller();
    const parsed = offerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    const d = parsed.data;
    const values = {
      pricePaise: rupeesToPaise(d.price),
      mrpPaise: rupeesToPaise(d.mrp),
      stock: d.stock,
      active: true,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.offers)
      .values({ sellerId: seller.id, productId: d.productId, ...values })
      .onConflictDoUpdate({ target: [schema.offers.sellerId, schema.offers.productId], set: values });
    await invalidateCatalog();
    revalidatePath("/seller/offers");
    revalidatePath("/seller/offers/new");
    return "Listing saved";
  });
}

const quickUpdateSchema = z.object({
  price: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
});

export async function quickUpdateOffer(
  offerId: string,
  patch: z.input<typeof quickUpdateSchema>,
): Promise<{ error?: string }> {
  const res = await attempt(async () => {
    const { seller } = await assertApprovedSeller();
    const parsed = quickUpdateSchema.safeParse(patch);
    if (!parsed.success) throw new DomainError("Enter a valid value");
    const [offer] = await db
      .select()
      .from(schema.offers)
      .where(and(eq(schema.offers.id, offerId), eq(schema.offers.sellerId, seller.id)));
    if (!offer) throw new DomainError("Listing not found");
    const pricePaise = parsed.data.price !== undefined ? rupeesToPaise(parsed.data.price) : undefined;
    if (pricePaise !== undefined && pricePaise > offer.mrpPaise) throw new DomainError("Price can't exceed MRP");
    await db
      .update(schema.offers)
      .set({ pricePaise, stock: parsed.data.stock, active: parsed.data.active, updatedAt: new Date() })
      .where(eq(schema.offers.id, offerId));
    await invalidateCatalog();
    revalidatePath("/seller/offers");
  });
  return { error: res?.error };
}

const requestSchema = z.object({
  name: z.string().trim().min(3),
  brand: z.string().trim().optional(),
  unit: z.string().trim().min(1, "Enter a pack size, e.g. 500 g"),
  categoryId: z.coerce.number().int(),
  note: z.string().trim().max(300).optional(),
});

export async function requestProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const { seller } = await assertApprovedSeller();
    const parsed = requestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    await db.insert(schema.productRequests).values({
      sellerId: seller.id,
      ...parsed.data,
      brand: parsed.data.brand || null,
      note: parsed.data.note || null,
    });
    revalidatePath("/seller/offers/new");
    return "Request sent. We'll add it to the catalogue once it's reviewed.";
  });
}

async function sellerOrderAction(fn: (seller: { id: string; storeName: string }) => Promise<unknown>) {
  const res = await attempt(async () => {
    const { seller } = await assertApprovedSeller();
    await fn(seller);
    revalidatePath("/seller");
  });
  return { error: res?.error };
}

export async function acceptOrder(sellerOrderId: string) {
  return sellerOrderAction((seller) => acceptSellerOrder(seller, sellerOrderId));
}

export async function packOrder(sellerOrderId: string) {
  return sellerOrderAction((seller) => packSellerOrder(seller, sellerOrderId));
}

export async function rejectOrder(sellerOrderId: string) {
  return sellerOrderAction(async (seller) => {
    const ok = await rejectSellerOrder(sellerOrderId, {
      reason: `${seller.storeName} couldn't fulfil the order. Finding another store`,
      actor: "seller",
      sellerId: seller.id,
    });
    if (!ok) throw new DomainError("This order can no longer be rejected.");
  });
}
