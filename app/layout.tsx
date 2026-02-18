import type { Metadata } from "next";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fitness Studio ERP",
  description: "MVP admin panel",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <header>
          <nav className="row">
            <Link href="/">Home</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/members">Members</Link>
            <Link href="/plans">Plans</Link>
            <Link href="/contracts">Contracts</Link>
            <Link href="/payments">Payments</Link>
            <Link href="/sessions">Sessions</Link>
            <Link href="/check-in">Check-In</Link>
            <Link href="/attendance">Attendance</Link>

            {session?.user && (
              <>
                <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit">Sign out</button>
                </form>
              </>
            )}
          </nav>
        </header>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
