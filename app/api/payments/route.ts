import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, PaymentType, Prisma } from "@prisma/client";

import {
  createPaymentSchema,
  isoDateStringSchema,
  paymentStatusSchema,
  paymentTypeSchema,
  uuidSchema,
} from "@/lib/payment-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";
import { auth } from "@/auth";

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

  // --- payment_type filter ---
  let typeFilter: { payment_type?: PaymentType } = {};
  const typeQuery = params.get("payment_type");
  if (typeQuery) {
    const parsed = paymentTypeSchema.safeParse(typeQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid payment_type query, expected: CONTRACT, PRODUCT_SALE, OTHER" },
        { status: 400 },
      );
    }
    typeFilter = { payment_type: parsed.data };
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
        ...typeFilter,
        ...memberIdFilter,
        ...contractIdFilter,
        ...paidAtFilter,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        contract: { select: { id: true, status: true } },
        product: { select: { id: true, name: true, sku: true } },
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

  const session = await auth();
  const userId = session?.user?.id ?? null;

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

  const {
    member_id,
    payment_type,
    contract_id,
    product_id,
    product_qty,
    amount_cents,
    currency,
    method,
    status,
    paid_at,
    note,
  } = parsedBody.data;

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

    // For product sales, verify product and decrement stock in a transaction
    if (payment_type === PaymentType.PRODUCT_SALE && product_id && product_qty) {
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { studio_id_id: { studio_id: studioId, id: product_id } },
        });

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        if (product.current_stock < product_qty) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Create payment
        const payment = await tx.payment.create({
          data: {
            studio_id: studioId,
            member_id,
            payment_type,
            contract_id: null,
            product_id,
            product_qty,
            amount_cents,
            currency,
            method,
            status,
            paid_at: paidAtDate,
            recorded_by_user_id: userId,
            note: note ?? null,
          },
          include: {
            member: { select: { id: true, first_name: true, last_name: true } },
            product: { select: { id: true, name: true, sku: true } },
          },
        });

        // Decrement product stock
        await tx.product.update({
          where: { studio_id_id: { studio_id: studioId, id: product_id } },
          data: { current_stock: { decrement: product_qty } },
        });

        // Record inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            studio_id: studioId,
            product_id,
            type: "SALE",
            quantity: product_qty,
            recorded_by_user_id: userId,
            note: `Payment ${payment.id}`,
          },
        });

        return payment;
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    // Non-product payment (contract or other)
    const payment = await prisma.payment.create({
      data: {
        studio_id: studioId,
        member_id,
        payment_type,
        contract_id: contract_id ?? null,
        product_id: null,
        product_qty: null,
        amount_cents,
        currency,
        method,
        status,
        paid_at: paidAtDate,
        recorded_by_user_id: userId,
        note: note ?? null,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        contract: { select: { id: true, status: true } },
      },
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "product not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ message: "insufficient stock for this product" }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "invalid studio_id, member_id, or contract_id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "failed to create payment" }, { status: 500 });
  }
}
