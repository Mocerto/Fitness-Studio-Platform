import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Returns the studio_id from the authenticated JWT session.
// The middleware guarantees that no unauthenticated request reaches
// an API route, so a missing studio_id here means a broken token —
// treat it as 401.
export async function getStudioId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.studio_id ?? null;
}

export function missingStudioHeaderResponse() {
  return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
}
