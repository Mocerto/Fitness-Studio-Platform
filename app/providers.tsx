"use client";

import { SessionProvider } from "next-auth/react";

// Wraps the app in NextAuth's SessionProvider so all client
// components can call useSession() to access the current user.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
