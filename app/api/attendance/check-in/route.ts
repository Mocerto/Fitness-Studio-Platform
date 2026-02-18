import { NextRequest, NextResponse } from "next/server";
import {
  AttendanceStatus,
  ContractStatus,
  MemberStatus,
  PlanType,
  Prisma,
  SessionStatus,
} from "@prisma/client";

import { checkInSchema } from "@/lib/attendance-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

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

  const parsedBody = checkInSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { session_id, member_id } = parsedBody.data;

  try {
    // Verify session belongs to studio and is not cancelled
    const session = await prisma.session.findFirst({
      where: { id: session_id, studio_id: studioId },
    });
    if (!session) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }
    if (session.status === SessionStatus.CANCELLED) {
      return NextResponse.json({ message: "session is cancelled" }, { status: 400 });
    }

    // Verify member belongs to studio and is ACTIVE
    const member = await prisma.member.findFirst({
      where: { id: member_id, studio_id: studioId },
    });
    if (!member) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }
    if (member.status !== MemberStatus.ACTIVE) {
      return NextResponse.json({ message: "member is not active" }, { status: 400 });
    }

    // Find the member's ACTIVE contract in this studio
    const contract = await prisma.contract.findFirst({
      where: { studio_id: studioId, member_id, status: ContractStatus.ACTIVE },
    });
    if (!contract) {
      return NextResponse.json({ message: "no active contract for this member" }, { status: 400 });
    }

    // For LIMITED plans, check remaining classes
    if (contract.plan_type_snapshot === PlanType.LIMITED) {
      if (contract.remaining_classes == null || contract.remaining_classes <= 0) {
        return NextResponse.json({ message: "no classes remaining on this contract" }, { status: 400 });
      }
    }

    // Atomically: create attendance + decrement remaining_classes if LIMITED
    const attendance = await prisma.$transaction(async (tx) => {
      const record = await tx.attendance.create({
        data: {
          studio_id: studioId,
          session_id,
          member_id,
          status: AttendanceStatus.CHECKED_IN,
          checked_in_at: new Date(),
        },
        include: {
          member: { select: { id: true, first_name: true, last_name: true } },
          session: { select: { id: true, starts_at: true } },
        },
      });

      if (contract.plan_type_snapshot === PlanType.LIMITED) {
        await tx.contract.update({
          where: { id: contract.id },
          data: { remaining_classes: { decrement: 1 } },
        });
      }

      return record;
    });

    return NextResponse.json({ data: attendance }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint (studio_id, session_id, member_id) — already checked in
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.attendance.findFirst({
        where: { studio_id: studioId, session_id, member_id },
        include: {
          member: { select: { id: true, first_name: true, last_name: true } },
          session: { select: { id: true, starts_at: true } },
        },
      });
      // Return 200 (not 201) to signal idempotent hit — remaining_classes was NOT decremented again
      return NextResponse.json({ data: existing, already_checked_in: true });
    }
    return NextResponse.json({ message: "failed to check in" }, { status: 500 });
  }
}
