import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma imports, no Node.js-only modules.
// Used by middleware.ts to validate the session at the Edge.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      // Always allow the login page
      if (isLoginPage) {
        // Already logged in → redirect to home
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      // All other pages require authentication
      return isLoggedIn;
    },
  },
  // Providers list is completed in auth.ts (Prisma is not available at the Edge)
  providers: [],
};
