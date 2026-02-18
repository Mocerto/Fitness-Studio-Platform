import { NextRequest, NextResponse } from "next/server";
import { Prisma, SessionStatus } from "@prisma/client";

import {
  createSessionSchema,
  isoDateStringSchema,
  sessionStatusSchema,
  uuidSchema,
} from "@/lib/session-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;

  // --- status filter ---
  let statusFilter: { status?: SessionStatus } = {};
  const statusQuery = params.get("status");
  if (statusQuery) {
    const parsed = sessionStatusSchema.safeParse(statusQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid status query, expected: SCHEDULED, CANCELLED" },
        { status: 400 },
      );
    }
    statusFilter = { status: parsed.data };
  }

  // --- class_type_id filter ---
  let classTypeIdFilter: { class_type_id?: string } = {};
  const classTypeIdQuery = params.get("class_type_id");
  if (classTypeIdQuery) {
    const parsed = uuidSchema.safeParse(classTypeIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid class_type_id query, expected a UUID" },
        { status: 400 },
      );
    }
    classTypeIdFilter = { class_type_id: parsed.data };
  }

  // --- coach_id filter ---
  let coachIdFilter: { coach_id?: string } = {};
  const coachIdQuery = params.get("coach_id");
  if (coachIdQuery) {
    const parsed = uuidSchema.safeParse(coachIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid coach_id query, expected a UUID" },
        { status: 400 },
      );
    }
    coachIdFilter = { coach_id: parsed.data };
  }

  // --- from/to date range filter on starts_at ---
  let fromDate: Date | undefined;
  const fromQuery = params.get("from");
  if (fromQuery) {
    const parsed = isoDateStringSchema.safeParse(fromQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid from date, expected YYYY-MM-DD" },
        { status: 400 },
      );
    }
    fromDate = new Date(parsed.data);
    if (Number.isNaN(fromDate.getTime())) {
      return NextResponse.json({ message: "invalid from date" }, { status: 400 });
    }
  }

  let toDate: Date | undefined;
  const toQuery = params.get("to");
  if (toQuery) {
    const parsed = isoDateStringSchema.safeParse(toQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid to date, expected YYYY-MM-DD" },
        { status: 400 },
      );
    }
    toDate = new Date(`${toQuery}T23:59:59.999Z`);
    if (Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ message: "invalid to date" }, { status: 400 });
    }
  }

  const hasPaidAtFilter = fromDate !== undefined || toDate !== undefined;
  const startsAtFilter = hasPaidAtFilter
    ? {
        starts_at: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      }
    : {};

  try {
    const sessions = await prisma.session.findMany({
      where: {
        studio_id: studioId,
        ...statusFilter,
        ...classTypeIdFilter,
        ...coachIdFilter,
        ...startsAtFilter,
      },
      include: {
        class_type: { select: { id: true, name: true } },
        coach: { select: { id: true, name: true } },
      },
      orderBy: { starts_at: "asc" },
    });

    return NextResponse.json({ data: sessions });
  } catch {
    return NextResponse.json({ message: "failed to load sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = createSessionSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { class_type_id, coach_id, starts_at, ends_at, capacity, status } = parsedBody.data;

  try {
    const classType = await prisma.classType.findFirst({
      where: { id: class_type_id, studio_id: studioId },
    });
    if (!classType) {
      return NextResponse.json({ message: "class type not found" }, { status: 404 });
    }

    if (coach_id) {
      const coach = await prisma.coach.findFirst({
        where: { id: coach_id, studio_id: studioId },
      });
      if (!coach) {
        return NextResponse.json({ message: "coach not found" }, { status: 404 });
      }
    }

    const session = await prisma.session.create({
      data: {
        studio_id: studioId,
        class_type_id,
        coach_id: coach_id ?? null,
        starts_at: new Date(starts_at),
        ends_at: ends_at ? new Date(ends_at) : null,
        capacity,
        status,
      },
      include: {
        class_type: { select: { id: true, name: true } },
        coach: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "invalid studio_id, class_type_id, or coach_id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "failed to create session" }, { status: 500 });
  }
}
