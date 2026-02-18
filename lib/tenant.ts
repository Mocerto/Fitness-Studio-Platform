import { NextRequest, NextResponse } from "next/server";

export function getStudioId(request: NextRequest): string | null {
  const studioId = request.headers.get("x-studio-id")?.trim();
  return studioId ? studioId : null;
}

export function missingStudioHeaderResponse() {
  return NextResponse.json({ message: "x-studio-id required" }, { status: 401 });
}
