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
    const classTypes = await prisma.classType.findMany({
      where: { studio_id: studioId, is_active: true },
      include: {
        discipline: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: classTypes });
  } catch {
    return NextResponse.json({ message: "failed to load class types" }, { status: 500 });
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

  const { name, discipline_id, default_capacity, duration_minutes } = body as {
    name?: string;
    discipline_id?: string;
    default_capacity?: number;
    duration_minutes?: number;
  };

  if (!name || !name.trim()) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  try {
    const classType = await prisma.classType.create({
      data: {
        studio_id: studioId,
        name: name.trim(),
        discipline_id: discipline_id || null,
        default_capacity: default_capacity ?? null,
        duration_minutes: duration_minutes ?? null,
      },
      include: {
        discipline: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: classType }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "class type already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "failed to create class type" }, { status: 500 });
  }
}
