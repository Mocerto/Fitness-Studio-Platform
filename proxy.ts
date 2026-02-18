import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use only the Edge-safe config here (no Prisma, no Node.js crypto).
// This runs before every matched request to verify the session cookie.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Protect all routes except:
    // - /login (auth page)
    // - /api/auth/* (NextAuth internal routes)
    // - Next.js internals and static files
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
