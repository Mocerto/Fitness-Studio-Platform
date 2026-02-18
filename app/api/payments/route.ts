import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, Prisma } from "@prisma/client";

import {
  createPaymentSchema,
  isoDateStringSchema,
  paymentStatusSchema,
  uuidSchema,
} from "@/lib/payment-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;

  // --- status filter ---
  let statusFilter: { status?: PaymentStatus } = {};
  const statusQuery = params.get("status");
  if (statusQuery) {
    const parsed = paymentStatusSchema.safeParse(statusQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid status query, expected: RECORDED, REFUNDED, VOID" },
        { status: 400 },
      );
    }
    statusFilter = { status: parsed.data };
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

  // --- contract_id filter ---
  let contractIdFilter: { contract_id?: string } = {};
  const contractIdQuery = params.get("contract_id");
  if (contractIdQuery) {
    const parsed = uuidSchema.safeParse(contractIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid contract_id query, expected a UUID" },
        { status: 400 },
      );
    }
    contractIdFilter = { contract_id: parsed.data };
  }

  // --- from/to date range filter on paid_at ---
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
      return NextResponse.json(
        { message: "invalid from date" },
        { status: 400 },
      );
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
    // include the full to-day up to its last millisecond
    toDate = new Date(`${toQuery}T23:59:59.999Z`);
    if (Number.isNaN(toDate.getTime())) {
      return NextResponse.json(
        { message: "invalid to date" },
        { status: 400 },
      );
    }
  }

  const hasPaidAtFilter = fromDate !== undefined || toDate !== undefined;
  const paidAtFilter = hasPaidAtFilter
    ? {
        paid_at: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      }
    : {};

  try {
    const payments = await prisma.payment.findMany({
      where: {
        studio_id: studioId,
        ...statusFilter,
        ...memberIdFilter,
        ...contractIdFilter,
        ...paidAtFilter,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        contract: { select: { id: true, status: true } },
      },
      orderBy: { paid_at: "desc" },
    });

    return NextResponse.json({ data: payments });
  } catch {
    return NextResponse.json({ message: "failed to load payments" }, { status: 500 });
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

  const parsedBody = createPaymentSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { member_id, contract_id, amount_cents, currency, method, status, paid_at, note } =
    parsedBody.data;

  try {
    // Verify member belongs to this studio
    const member = await prisma.member.findFirst({
      where: { id: member_id, studio_id: studioId },
    });
    if (!member) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    // If a contract is provided, verify it belongs to this studio AND to this member
    if (contract_id) {
      const contract = await prisma.contract.findFirst({
        where: { id: contract_id, studio_id: studioId },
      });
      if (!contract) {
        return NextResponse.json({ message: "contract not found" }, { status: 404 });
      }
      if (contract.member_id !== member_id) {
        return NextResponse.json(
          { message: "contract does not belong to this member" },
          { status: 400 },
        );
      }
    }

    let paidAtDate: Date;
    if (paid_at) {
      paidAtDate = new Date(paid_at);
      if (Number.isNaN(paidAtDate.getTime())) {
        return NextResponse.json(
          { message: "invalid paid_at, expected ISO datetime or YYYY-MM-DD" },
          { status: 400 },
        );
      }
    } else {
      paidAtDate = new Date();
    }

    const payment = await prisma.payment.create({
      data: {
        studio_id: studioId,
        member_id,
        contract_id: contract_id ?? null,
        amount_cents,
        currency,
        method,
        status,
        paid_at: paidAtDate,
        recorded_by_user_id: null,
        note: note ?? null,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        contract: { select: { id: true, status: true } },
      },
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "invalid studio_id, member_id, or contract_id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "failed to create payment" }, { status: 500 });
  }
}
