"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { invalidateCatalog } from "@/lib/cache";
import { assertRole } from "@/server/authz";
import { attempt, type ActionState } from "@/server/action-result";
import { DomainError, settleSeller } from "@/server/domain/orders";
import { markRiderUnavailable } from "@/server/domain/riders";

type Approval = (typeof schema.approvalEnum.enumValues)[number];

async function adminAction(fn: () => Promise<string | void>, path: string) {
  const res = await attempt(async () => {
    await assertRole("admin");
    const msg = await fn();
    revalidatePath(path);
    return msg;
  });
  return { error: res?.error, success: res?.success };
}

export async function setSellerStatus(sellerId: string, status: Approval) {
  return adminAction(async () => {
    await db.update(schema.sellers).set({ status }).where(eq(schema.sellers.id, sellerId));
    await invalidateCatalog();
  }, "/admin/sellers");
}

export async function setSellerCommission(sellerId: string, percent: number) {
  return adminAction(async () => {
    if (!(percent >= 0 && percent <= 50)) throw new DomainError("Commission must be between 0 and 50%");
    await db
      .update(schema.sellers)
      .set({ commissionBps: Math.round(percent * 100) })
      .where(eq(schema.sellers.id, sellerId));
  }, "/admin/sellers");
}

export async function setRiderApproval(riderId: string, approval: Approval) {
  return adminAction(async () => {
    const [rider] = await db.select().from(schema.riders).where(eq(schema.riders.id, riderId));
    if (!rider) throw new DomainError("Rider not found");
    if (approval !== "APPROVED" && rider.status === "BUSY") {
      throw new DomainError("Rider is on a delivery. Try again once it's done.");
    }
    await db
      .update(schema.riders)
      .set({ approval, status: approval === "APPROVED" ? rider.status : "OFFLINE" })
      .where(eq(schema.riders.id, riderId));
    if (approval !== "APPROVED") await markRiderUnavailable(riderId);
  }, "/admin/riders");
}

const productSchema = z.object({
  name: z.string().trim().min(2),
  brand: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  categoryId: z.coerce.number().int(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    await assertRole("admin");
    const parsed = productSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    const d = parsed.data;
    await db.insert(schema.products).values({
      ...d,
      brand: d.brand || null,
      description: d.description || null,
      imageUrl: d.imageUrl || null,
    });
    revalidatePath("/admin/catalog");
    return `${d.name} added to the catalogue`;
  });
}

export async function setProductActive(productId: string, active: boolean) {
  return adminAction(async () => {
    await db.update(schema.products).set({ active }).where(eq(schema.products.id, productId));
    await invalidateCatalog();
  }, "/admin/catalog");
}

export async function reviewProductRequest(requestId: string, approve: boolean) {
  return adminAction(async () => {
    await db.transaction(async (tx) => {
      const [req] = await tx
        .select()
        .from(schema.productRequests)
        .where(and(eq(schema.productRequests.id, requestId), eq(schema.productRequests.status, "PENDING")))
        .for("update");
      if (!req) throw new DomainError("Request already reviewed");
      let productId: string | null = null;
      if (approve) {
        const [p] = await tx
          .insert(schema.products)
          .values({ name: req.name, brand: req.brand, unit: req.unit, categoryId: req.categoryId })
          .returning({ id: schema.products.id });
        productId = p.id;
      }
      await tx
        .update(schema.productRequests)
        .set({ status: approve ? "APPROVED" : "REJECTED", productId })
        .where(eq(schema.productRequests.id, requestId));
    });
    return approve ? "Product added to the catalogue" : "Request rejected";
  }, "/admin/catalog");
}

export async function settlePayout(sellerId: string) {
  return adminAction(async () => {
    const paid = await settleSeller(sellerId);
    if (paid === 0) throw new DomainError("Nothing to settle");
    return `Paid out ₹${(paid / 100).toFixed(2)}`;
  }, "/admin/payouts");
}
