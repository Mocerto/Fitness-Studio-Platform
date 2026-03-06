import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

// PUT replaces all discipline assignments for a coach
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id: coachId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const { discipline_ids } = body as { discipline_ids?: string[] };
  if (!Array.isArray(discipline_ids)) {
    return NextResponse.json({ message: "discipline_ids must be an array" }, { status: 400 });
  }

  try {
    // Verify coach exists
    const coach = await prisma.coach.findUnique({
      where: { studio_id_id: { studio_id: studioId, id: coachId } },
    });
    if (!coach) {
      return NextResponse.json({ message: "coach not found" }, { status: 404 });
    }

    // Replace all assignments: delete existing, create new
    await prisma.$transaction([
      prisma.coachDiscipline.deleteMany({
        where: { studio_id: studioId, coach_id: coachId },
      }),
      ...discipline_ids.map((did) =>
        prisma.coachDiscipline.create({
          data: { studio_id: studioId, coach_id: coachId, discipline_id: did },
        }),
      ),
    ]);

    // Return updated coach with disciplines
    const updated = await prisma.coach.findUnique({
      where: { studio_id_id: { studio_id: studioId, id: coachId } },
      include: {
        disciplines: {
          include: { discipline: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updated!.id,
        name: updated!.name,
        is_active: updated!.is_active,
        disciplines: updated!.disciplines.map((cd) => cd.discipline),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid discipline_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to update disciplines" }, { status: 500 });
  }
}
