import { redirect } from "next/navigation";
import { auth } from "@/auth";

const HOME = { admin: "/admin", seller: "/seller", rider: "/rider", customer: "/" } as const;

/** Sends each role to its own home after sign-in (or back to where a customer came from). */
export default async function PostLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { next } = await searchParams;
  const role = session.user.role;
  if (role === "customer" && next?.startsWith("/") && !next.startsWith("//")) redirect(next);
  redirect(HOME[role]);
}
