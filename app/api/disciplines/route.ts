import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET() {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  try {
    const disciplines = await prisma.discipline.findMany({
      where: { studio_id: studioId },
      include: {
        coaches: {
          include: {
            coach: { select: { id: true, name: true, is_active: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Flatten the response for easier consumption
    const result = disciplines.map((d) => ({
      id: d.id,
      name: d.name,
      is_active: d.is_active,
      coaches: d.coaches.map((cd) => cd.coach),
    }));

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ message: "failed to load disciplines" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const { name } = body as { name?: string };
  if (!name || !name.trim()) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  try {
    const discipline = await prisma.discipline.create({
      data: { studio_id: studioId, name: name.trim() },
    });

    return NextResponse.json({ data: discipline }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "discipline already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "failed to create discipline" }, { status: 500 });
  }
}
