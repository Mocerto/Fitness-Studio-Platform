import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const disciplineId = request.nextUrl.searchParams.get("discipline_id");

  try {
    const where: Prisma.CoachWhereInput = { studio_id: studioId, is_active: true };

    // If filtering by discipline, only return coaches with that discipline
    if (disciplineId) {
      where.disciplines = {
        some: { discipline_id: disciplineId },
      };
    }

    const coaches = await prisma.coach.findMany({
      where,
      include: {
        disciplines: {
          include: {
            discipline: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = coaches.map((c) => ({
      id: c.id,
      name: c.name,
      is_active: c.is_active,
      disciplines: c.disciplines.map((cd) => cd.discipline),
    }));

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ message: "failed to load coaches" }, { status: 500 });
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

  const { name, discipline_ids } = body as { name?: string; discipline_ids?: string[] };

  if (!name || !name.trim()) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  try {
    const coach = await prisma.coach.create({
      data: {
        studio_id: studioId,
        name: name.trim(),
        disciplines:
          discipline_ids && discipline_ids.length > 0
            ? {
                create: discipline_ids.map((did) => ({
                  studio_id: studioId,
                  discipline_id: did,
                })),
              }
            : undefined,
      },
      include: {
        disciplines: {
          include: {
            discipline: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: coach.id,
          name: coach.name,
          is_active: coach.is_active,
          disciplines: coach.disciplines.map((cd) => cd.discipline),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "coach already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "failed to create coach" }, { status: 500 });
  }
}
