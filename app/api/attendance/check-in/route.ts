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

// Sentinel thrown inside the transaction to signal a lost decrement race.
// Distinct from PrismaClientKnownRequestError so the catch block can tell them apart.
const NO_CLASSES_REMAINING = "NO_CLASSES_REMAINING";

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

    // HIGH-1: load ALL ACTIVE contracts to detect ambiguous state.
    const contracts = await prisma.contract.findMany({
      where: { studio_id: studioId, member_id, status: ContractStatus.ACTIVE },
    });
    if (contracts.length === 0) {
      return NextResponse.json({ message: "no active contract for this member" }, { status: 400 });
    }
    if (contracts.length > 1) {
      return NextResponse.json({ message: "multiple active contracts for this member" }, { status: 409 });
    }
    const contract = contracts[0];

    // HIGH-2: both the availability check and the decrement live inside the transaction.
    // This prevents two concurrent requests from both passing an outside check and both
    // decrementing, which would push remaining_classes below zero.
    const attendance = await prisma.$transaction(async (tx) => {
      // Step 1: insert attendance first.
      // If (studio_id, session_id, member_id) already exists, Prisma throws P2002
      // before we ever reach the decrement — so no double-decrement is possible.
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

      // Step 2: conditional decrement for LIMITED plans.
      // The WHERE clause atomically guards remaining_classes > 0.
      // If another request already decremented to 0, count will be 0 and we abort.
      // MEDIUM-1: studio_id included for tenant safety on the write path.
      if (contract.plan_type_snapshot === PlanType.LIMITED) {
        const decremented = await tx.contract.updateMany({
          where: { id: contract.id, studio_id: studioId, remaining_classes: { gt: 0 } },
          data: { remaining_classes: { decrement: 1 } },
        });
        if (decremented.count !== 1) {
          // Throwing here aborts the transaction → attendance row is rolled back.
          throw new Error(NO_CLASSES_REMAINING);
        }
      }

      return record;
    });

    return NextResponse.json({ data: attendance }, { status: 201 });
  } catch (error: unknown) {
    // Duplicate check-in: unique constraint on (studio_id, session_id, member_id).
    // Thrown by tx.attendance.create before the decrement step runs,
    // so remaining_classes is NOT decremented.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.attendance.findFirst({
        where: { studio_id: studioId, session_id, member_id },
        include: {
          member: { select: { id: true, first_name: true, last_name: true } },
          session: { select: { id: true, starts_at: true } },
        },
      });
      // 200 (not 201) signals idempotent hit; attendance row already exists
      return NextResponse.json({ data: existing, already_checked_in: true });
    }
    // Conditional decrement found remaining_classes = 0; attendance row rolled back.
    if (error instanceof Error && error.message === NO_CLASSES_REMAINING) {
      return NextResponse.json({ message: "no classes remaining on this contract" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to check in" }, { status: 500 });
  }
}
