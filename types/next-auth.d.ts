import type { DefaultSession } from "next-auth";

// Augment the built-in Session and JWT types to include
// our custom fields: studio_id and role.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      studio_id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    studio_id: string;
    role: string;
  }
}
