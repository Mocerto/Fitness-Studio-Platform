import { NextRequest, NextResponse } from "next/server";
import {
  AttendanceStatus,
  ExpenseStatus,
  LeadStatus,
  MemberStatus,
  PaymentStatus,
  PaymentType,
  SessionStatus,
} from "@prisma/client";

import { isoDateStringSchema } from "@/lib/payment-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;
  const todayStr = new Date().toISOString().split("T")[0];

  const fromStr = params.get("from") ?? todayStr;
  const fromParsed = isoDateStringSchema.safeParse(fromStr);
  if (!fromParsed.success) {
    return NextResponse.json({ message: "invalid from date" }, { status: 400 });
  }
  const fromDate = new Date(`${fromParsed.data}T00:00:00.000Z`);

  const toStr = params.get("to") ?? todayStr;
  const toParsed = isoDateStringSchema.safeParse(toStr);
  if (!toParsed.success) {
    return NextResponse.json({ message: "invalid to date" }, { status: 400 });
  }
  const toDate = new Date(`${toParsed.data}T23:59:59.999Z`);

  try {
    const [
      // Financial
      revenueAgg,
      revenueByType,
      expenseAgg,
      paymentsCount,
      // Attendance
      checkinsCount,
      cancelledAttendanceCount,
      noShowCount,
      // Members
      activeMembersCount,
      frozenMembersCount,
      inactiveMembersCount,
      // Sessions
      sessionsScheduledCount,
      sessionsCancelledCount,
      // Leads
      leadsPipeline,
      // Products
      productSalesAgg,
    ] = await Promise.all([
      // Revenue total
      prisma.payment.aggregate({
        where: {
          studio_id: studioId,
          status: PaymentStatus.RECORDED,
          paid_at: { gte: fromDate, lte: toDate },
        },
        _sum: { amount_cents: true },
      }),
      // Revenue by payment type
      prisma.payment.groupBy({
        by: ["payment_type"],
        where: {
          studio_id: studioId,
          status: PaymentStatus.RECORDED,
          paid_at: { gte: fromDate, lte: toDate },
        },
        _sum: { amount_cents: true },
        _count: true,
      }),
      // Expenses total
      prisma.expense.aggregate({
        where: {
          studio_id: studioId,
          status: ExpenseStatus.RECORDED,
          expense_date: { gte: fromDate, lte: toDate },
        },
        _sum: { amount_cents: true },
      }),
      // Payments count
      prisma.payment.count({
        where: {
          studio_id: studioId,
          paid_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Check-ins
      prisma.attendance.count({
        where: {
          studio_id: studioId,
          status: AttendanceStatus.CHECKED_IN,
          checked_in_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Cancelled attendance
      prisma.attendance.count({
        where: {
          studio_id: studioId,
          status: AttendanceStatus.CANCELLED,
          created_at: { gte: fromDate, lte: toDate },
        },
      }),
      // No-shows
      prisma.attendance.count({
        where: {
          studio_id: studioId,
          status: AttendanceStatus.NO_SHOW,
          created_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Member counts
      prisma.member.count({
        where: { studio_id: studioId, status: MemberStatus.ACTIVE },
      }),
      prisma.member.count({
        where: { studio_id: studioId, status: MemberStatus.FROZEN },
      }),
      prisma.member.count({
        where: { studio_id: studioId, status: MemberStatus.INACTIVE },
      }),
      // Sessions
      prisma.session.count({
        where: {
          studio_id: studioId,
          status: SessionStatus.SCHEDULED,
          starts_at: { gte: fromDate, lte: toDate },
        },
      }),
      prisma.session.count({
        where: {
          studio_id: studioId,
          status: SessionStatus.CANCELLED,
          starts_at: { gte: fromDate, lte: toDate },
        },
      }),
      // Leads pipeline
      prisma.lead.groupBy({
        by: ["status"],
        where: { studio_id: studioId },
        _count: true,
      }),
      // Product sales in range
      prisma.payment.aggregate({
        where: {
          studio_id: studioId,
          payment_type: PaymentType.PRODUCT_SALE,
          status: PaymentStatus.RECORDED,
          paid_at: { gte: fromDate, lte: toDate },
        },
        _sum: { amount_cents: true },
        _count: true,
      }),
    ]);

    const revenueCents = revenueAgg._sum.amount_cents ?? 0;
    const expenseCents = expenseAgg._sum.amount_cents ?? 0;
    const profitCents = revenueCents - expenseCents;

    // Build revenue breakdown
    const revenueBreakdown: Record<string, { amount_cents: number; count: number }> = {};
    for (const group of revenueByType) {
      revenueBreakdown[group.payment_type] = {
        amount_cents: group._sum.amount_cents ?? 0,
        count: group._count,
      };
    }

    // Build leads pipeline
    const leadsTotal = leadsPipeline.reduce((acc, g) => acc + g._count, 0);
    const leadsConverted =
      leadsPipeline.find((g) => g.status === LeadStatus.CONVERTED)?._count ?? 0;
    const leadsConversionRate =
      leadsTotal > 0 ? ((leadsConverted / leadsTotal) * 100).toFixed(1) : "0.0";
    const leadsPipelineMap: Record<string, number> = {};
    for (const g of leadsPipeline) {
      leadsPipelineMap[g.status] = g._count;
    }

    return NextResponse.json({
      data: {
        from: fromParsed.data,
        to: toParsed.data,
        // Financial
        revenue_cents: revenueCents,
        expense_cents: expenseCents,
        profit_cents: profitCents,
        revenue_breakdown: revenueBreakdown,
        payments_count: paymentsCount,
        product_sales_cents: productSalesAgg._sum.amount_cents ?? 0,
        product_sales_count: productSalesAgg._count ?? 0,
        // Attendance
        attendance_checkins: checkinsCount,
        attendance_cancelled: cancelledAttendanceCount,
        attendance_no_shows: noShowCount,
        attendance_rate:
          checkinsCount + noShowCount > 0
            ? ((checkinsCount / (checkinsCount + noShowCount)) * 100).toFixed(1)
            : "100.0",
        // Members
        members_active: activeMembersCount,
        members_frozen: frozenMembersCount,
        members_inactive: inactiveMembersCount,
        // Sessions
        sessions_scheduled: sessionsScheduledCount,
        sessions_cancelled: sessionsCancelledCount,
        // Leads
        leads_total: leadsTotal,
        leads_converted: leadsConverted,
        leads_conversion_rate: leadsConversionRate,
        leads_pipeline: leadsPipelineMap,
      },
    });
  } catch {
    return NextResponse.json({ message: "failed to load dashboard" }, { status: 500 });
  }
}
