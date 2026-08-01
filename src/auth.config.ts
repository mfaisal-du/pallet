import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe auth config (no Prisma / Node-only imports).
 * Used by middleware. Full providers live in auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  logger: {
    error(error) {
      // A stale session cookie that cannot be decrypted (e.g. left over from
      // a previous AUTH_SECRET, another project on the same port, or a secret
      // rotation) raises JWTSessionError. safeAuth already treats that as
      // "not signed in", so keep the console clean instead of logging it as
      // an error on every request.
      if (error instanceof Error) {
        const text = `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`;
        if (/jwtsessionerror|no matching decryption secret/i.test(text)) {
          return;
        }
      }
      console.error(error);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: Role }).role;
        token.roles = (user as { roles?: Role[] }).roles ?? [(user as { role: Role }).role];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.roles = (token.roles as Role[] | undefined) ?? [token.role as Role];
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
