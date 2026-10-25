import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser(role?: Role) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/");
  return user;
}

/** Throws instead of redirecting; for server actions that return error state. */
export async function assertRole(role: Role) {
  const user = await getSessionUser();
  if (!user || user.role !== role) throw new Error("Not authorized");
  return user;
}

export async function getSellerForUser(userId: string) {
  return db.query.sellers.findFirst({ where: eq(schema.sellers.userId, userId) });
}

export async function requireSeller({ approved = true } = {}) {
  const user = await requireUser("seller");
  const seller = await getSellerForUser(user.id);
  if (!seller) redirect("/register/seller");
  if (approved && seller.status !== "APPROVED") redirect("/seller");
  return { user, seller };
}

export async function assertApprovedSeller() {
  const user = await assertRole("seller");
  const seller = await getSellerForUser(user.id);
  if (!seller || seller.status !== "APPROVED") throw new Error("Your store is not approved yet");
  return { user, seller };
}

export async function getRiderForUser(userId: string) {
  return db.query.riders.findFirst({ where: eq(schema.riders.userId, userId) });
}

export async function assertApprovedRider() {
  const user = await assertRole("rider");
  const rider = await getRiderForUser(user.id);
  if (!rider || rider.approval !== "APPROVED") throw new Error("Your rider account is not approved yet");
  return { user, rider };
}
