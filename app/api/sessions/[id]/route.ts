import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { sessionIdParamSchema, updateSessionSchema } from "@/lib/session-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await context.params;
  const parsedId = sessionIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updateSessionSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.session.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });
    if (!existing) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }

    // Re-verify class_type tenant ownership if changing it
    if (parsedBody.data.class_type_id !== undefined) {
      const classType = await prisma.classType.findFirst({
        where: { id: parsedBody.data.class_type_id, studio_id: studioId },
      });
      if (!classType) {
        return NextResponse.json({ message: "class type not found" }, { status: 404 });
      }
    }

    // Re-verify coach tenant ownership if changing it
    if (parsedBody.data.coach_id !== undefined) {
      const coach = await prisma.coach.findFirst({
        where: { id: parsedBody.data.coach_id, studio_id: studioId },
      });
      if (!coach) {
        return NextResponse.json({ message: "coach not found" }, { status: 404 });
      }
    }

    // Merge starts_at and ends_at, then validate ordering
    const nextStartsAt =
      parsedBody.data.starts_at !== undefined
        ? new Date(parsedBody.data.starts_at)
        : existing.starts_at;

    const nextEndsAt =
      parsedBody.data.ends_at !== undefined ? new Date(parsedBody.data.ends_at) : existing.ends_at;

    if (nextEndsAt !== null && nextEndsAt <= nextStartsAt) {
      return NextResponse.json(
        { message: "ends_at must be after starts_at" },
        { status: 400 },
      );
    }

    // Build explicit update data — convert string dates to Date objects
    const updateData: Record<string, unknown> = {};
    if (parsedBody.data.class_type_id !== undefined)
      updateData.class_type_id = parsedBody.data.class_type_id;
    if (parsedBody.data.coach_id !== undefined) updateData.coach_id = parsedBody.data.coach_id;
    if (parsedBody.data.starts_at !== undefined) updateData.starts_at = nextStartsAt;
    if (parsedBody.data.ends_at !== undefined) updateData.ends_at = nextEndsAt;
    if (parsedBody.data.capacity !== undefined) updateData.capacity = parsedBody.data.capacity;

    const updated = await prisma.session.updateMany({
      where: { id: parsedId.data, studio_id: studioId },
      data: updateData,
    });

    if (updated.count === 0) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }

    const session = await prisma.session.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
      include: {
        class_type: { select: { id: true, name: true } },
        coach: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: session });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "invalid class_type_id or coach_id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "failed to update session" }, { status: 500 });
  }
}
