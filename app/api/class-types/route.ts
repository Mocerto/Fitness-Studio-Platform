import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  try {
    const classTypes = await prisma.classType.findMany({
      where: { studio_id: studioId, is_active: true },
      select: { id: true, name: true, default_capacity: true, duration_minutes: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: classTypes });
  } catch {
    return NextResponse.json({ message: "failed to load class types" }, { status: 500 });
  }
}
