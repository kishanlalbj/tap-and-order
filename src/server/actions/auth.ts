"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db, schema } from "@/db";
import { toPoint } from "@/lib/geo";
import type { ActionState } from "@/server/action-result";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const next = String(formData.get("next") || "");
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: `/post-login${next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""}`,
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "Wrong email or password." };
    throw err;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

const baseUser = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone must be 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const sellerFields = baseUser.extend({
  storeName: z.string().trim().min(3, "Enter your store name"),
  addressLine: z.string().trim().min(5, "Enter the store address"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  serviceRadiusKm: z.coerce.number().min(1).max(15),
});

const riderFields = baseUser.extend({ vehicle: z.enum(["bike", "scooter", "bicycle"]) });

type Role = "customer" | "seller" | "rider";

async function createUser(role: Role, data: z.infer<typeof baseUser>) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, data.email) });
  if (existing) return { error: "An account with this email already exists." } as const;
  const [user] = await db
    .insert(schema.users)
    .values({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role,
      passwordHash: await bcrypt.hash(data.password, 10),
    })
    .returning();
  return { user } as const;
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";

async function signInNew(email: string, password: string) {
  await signIn("credentials", { email, password, redirectTo: "/post-login" });
}

export async function registerCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = baseUser.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const res = await createUser("customer", parsed.data);
  if ("error" in res) return res;
  await signInNew(parsed.data.email, parsed.data.password);
}

export async function registerSeller(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = sellerFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  const res = await createUser("seller", d);
  if ("error" in res) return res;
  await db.insert(schema.sellers).values({
    userId: res.user.id,
    storeName: d.storeName,
    addressLine: d.addressLine,
    location: toPoint(d),
    serviceRadiusM: Math.round(d.serviceRadiusKm * 1000),
    commissionBps: Number(process.env.COMMISSION_DEFAULT_BPS ?? 1500),
  });
  await signInNew(d.email, d.password);
}

export async function registerRider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = riderFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const res = await createUser("rider", parsed.data);
  if ("error" in res) return res;
  await db.insert(schema.riders).values({ userId: res.user.id, vehicle: parsed.data.vehicle });
  await signInNew(parsed.data.email, parsed.data.password);
}
