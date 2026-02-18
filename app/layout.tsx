import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Fitness Studio ERP",
  description: "MVP admin panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav className="row">
            <Link href="/">Home</Link>
            <Link href="/members">Members</Link>
            <Link href="/plans">Plans</Link>
            <Link href="/contracts">Contracts</Link>
            <Link href="/payments">Payments</Link>
            <Link href="/sessions">Sessions</Link>
            <Link href="/check-in">Check-In</Link>
            <Link href="/attendance">Attendance</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
