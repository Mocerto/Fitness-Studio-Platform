import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  try {
    const coaches = await prisma.coach.findMany({
      where: { studio_id: studioId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: coaches });
  } catch {
    return NextResponse.json({ message: "failed to load coaches" }, { status: 500 });
  }
}
