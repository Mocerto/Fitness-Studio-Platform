import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

import {
  attendanceStatusSchema,
  uuidSchema,
} from "@/lib/attendance-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;

  // --- status filter ---
  let statusFilter: { status?: AttendanceStatus } = {};
  const statusQuery = params.get("status");
  if (statusQuery) {
    const parsed = attendanceStatusSchema.safeParse(statusQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid status query, expected: CHECKED_IN, CANCELLED, NO_SHOW" },
        { status: 400 },
      );
    }
    statusFilter = { status: parsed.data };
  }

  // --- session_id filter ---
  let sessionIdFilter: { session_id?: string } = {};
  const sessionIdQuery = params.get("session_id");
  if (sessionIdQuery) {
    const parsed = uuidSchema.safeParse(sessionIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid session_id query, expected a UUID" },
        { status: 400 },
      );
    }
    sessionIdFilter = { session_id: parsed.data };
  }

  // --- member_id filter ---
  let memberIdFilter: { member_id?: string } = {};
  const memberIdQuery = params.get("member_id");
  if (memberIdQuery) {
    const parsed = uuidSchema.safeParse(memberIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid member_id query, expected a UUID" },
        { status: 400 },
      );
    }
    memberIdFilter = { member_id: parsed.data };
  }

  try {
    const records = await prisma.attendance.findMany({
      where: {
        studio_id: studioId,
        ...statusFilter,
        ...sessionIdFilter,
        ...memberIdFilter,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        session: {
          select: {
            id: true,
            starts_at: true,
            class_type: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ data: records });
  } catch {
    return NextResponse.json({ message: "failed to load attendance" }, { status: 500 });
  }
}
