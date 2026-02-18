import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, MemberStatus, PaymentStatus, SessionStatus } from "@prisma/client";

import { isoDateStringSchema } from "@/lib/payment-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;
  const todayStr = new Date().toISOString().split("T")[0];

  // --- from date (default: today) ---
  const fromStr = params.get("from") ?? todayStr;
  const fromParsed = isoDateStringSchema.safeParse(fromStr);
  if (!fromParsed.success) {
    return NextResponse.json(
      { message: "invalid from date, expected YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const fromDate = new Date(`${fromParsed.data}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime())) {
    return NextResponse.json({ message: "invalid from date" }, { status: 400 });
  }

  // --- to date (default: today, end of day) ---
  const toStr = params.get("to") ?? todayStr;
  const toParsed = isoDateStringSchema.safeParse(toStr);
  if (!toParsed.success) {
    return NextResponse.json(
      { message: "invalid to date, expected YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const toDate = new Date(`${toParsed.data}T23:59:59.999Z`);
  if (Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ message: "invalid to date" }, { status: 400 });
  }

  try {
    const [
      revenueAgg,
      paymentsCount,
      checkinsCount,
      cancelledAttendanceCount,
      activeMembersCount,
      sessionsScheduledCount,
      sessionsCancelledCount,
    ] = await Promise.all([
      // Revenue: sum amount_cents for RECORDED payments in range
      prisma.payment.aggregate({
        where: {
          studio_id: studioId,
          status: PaymentStatus.RECORDED,
          paid_at: { gte: fromDate, lte: toDate },
        },
        _sum: { amount_cents: true },
      }),
      // Total payments count in range (all statuses)
      prisma.payment.count({
        where: {
          studio_id: studioId,
          paid_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Check-ins in range (keyed on checked_in_at)
      prisma.attendance.count({
        where: {
          studio_id: studioId,
          status: AttendanceStatus.CHECKED_IN,
          checked_in_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Cancelled attendance records created in range
      prisma.attendance.count({
        where: {
          studio_id: studioId,
          status: AttendanceStatus.CANCELLED,
          created_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Active members snapshot (not date-filtered)
      prisma.member.count({
        where: { studio_id: studioId, status: MemberStatus.ACTIVE },
      }),
      // Scheduled sessions starting in range
      prisma.session.count({
        where: {
          studio_id: studioId,
          status: SessionStatus.SCHEDULED,
          starts_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Cancelled sessions starting in range
      prisma.session.count({
        where: {
          studio_id: studioId,
          status: SessionStatus.CANCELLED,
          starts_at: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        from: fromParsed.data,
        to: toParsed.data,
        revenue_cents_total: revenueAgg._sum.amount_cents ?? 0,
        payments_count: paymentsCount,
        attendance_checkins_count: checkinsCount,
        attendance_cancelled_count: cancelledAttendanceCount,
        active_members_count: activeMembersCount,
        sessions_scheduled_count: sessionsScheduledCount,
        sessions_cancelled_count: sessionsCancelledCount,
      },
    });
  } catch {
    return NextResponse.json({ message: "failed to load dashboard" }, { status: 500 });
  }
}
