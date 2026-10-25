import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/db/schema";

// Edge-safe config shared by middleware and the full auth instance (no DB / bcrypt imports here).

const ROLE_PREFIXES: [string, Role][] = [
  ["/seller", "seller"],
  ["/admin", "admin"],
  ["/rider", "rider"],
];

const CUSTOMER_PATHS = ["/cart", "/checkout", "/orders", "/account"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const role = auth?.user?.role;

      // Registration pages live under role prefixes but must stay public.
      if (path.startsWith("/register")) return true;

      for (const [prefix, required] of ROLE_PREFIXES) {
        if (path === prefix || path.startsWith(`${prefix}/`)) {
          if (!role) return false;
          return role === required ? true : Response.redirect(new URL("/", nextUrl));
        }
      }
      if (CUSTOMER_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return !!role;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
