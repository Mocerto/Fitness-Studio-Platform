import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // No Prisma adapter: we use JWT-only sessions.
  // This keeps our existing users table schema untouched —
  // no NextAuth-managed Account/Session tables needed.
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Find the user by email. For MVP we assume email is globally unique
        // across studios (same email in two studios is unlikely in practice).
        const user = await prisma.user.findFirst({
          where: { email, is_active: true },
          select: {
            id: true,
            email: true,
            full_name: true,
            studio_id: true,
            role: true,
            is_active: true,
            password_hash: true,
          },
        });

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.full_name ?? user.email,
          studio_id: user.studio_id,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Runs on sign-in and whenever the JWT is accessed.
    // user is present only on the initial sign-in call.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.studio_id = (user as { studio_id: string }).studio_id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    // Exposes JWT fields to the client-side session object.
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.studio_id = token.studio_id as string;
      session.user.role = token.role as string;
      return session;
    },
  },
});
