import { DomainError } from "@/server/domain/orders";

export type ActionState = { error?: string; success?: string } | undefined;

/** Runs a server action body and turns known errors into form state instead of an error page. */
export async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const success = await fn();
    return { success: success ?? undefined };
  } catch (err) {
    // redirect() and notFound() work by throwing; let those through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    if (err instanceof DomainError) return { error: err.message };
    if (err instanceof Error && /not authorized|not approved/i.test(err.message)) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Please try again." };
  }
}
