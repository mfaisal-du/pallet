import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { rolesOfUser } from "@/lib/roles";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface User {
    role: Role;
    roles: Role[];
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      roles: Role[];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    roles?: Role[];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.active) return null;

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // rolesOfUser falls back to [role] for legacy rows without a roles set
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roles: rolesOfUser(user as { role: Role; roles?: unknown }),
        };
      },
    }),
  ],
});
