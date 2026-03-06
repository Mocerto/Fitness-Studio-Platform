import { NextRequest, NextResponse } from "next/server";
import { ExpenseStatus, Prisma } from "@prisma/client";

import { createExpenseSchema, expenseStatusSchema } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const categoryId = request.nextUrl.searchParams.get("category_id");
  const statusQuery = request.nextUrl.searchParams.get("status");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const where: Prisma.ExpenseWhereInput = { studio_id: studioId };

  if (categoryId) {
    where.category_id = categoryId;
  }

  if (statusQuery) {
    const parsedStatus = expenseStatusSchema.safeParse(statusQuery);
    if (!parsedStatus.success) {
      return NextResponse.json(
        { message: "invalid status query", errors: parsedStatus.error.flatten() },
        { status: 400 },
      );
    }
    where.status = parsedStatus.data;
  }

  if (from || to) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.expense_date = dateFilter;
  }

  try {
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        recorded_by_user: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { expense_date: "desc" },
    });

    // Compute totals for the filtered set
    const totals = expenses.reduce(
      (acc, exp) => {
        if (exp.status === ExpenseStatus.RECORDED) {
          acc.total_cents += exp.amount_cents;
          acc.count += 1;
        }
        return acc;
      },
      { total_cents: 0, count: 0 },
    );

    return NextResponse.json({ data: expenses, totals });
  } catch {
    return NextResponse.json({ message: "failed to load expenses" }, { status: 500 });
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

  const parsedBody = createExpenseSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        studio_id: studioId,
        description: parsedBody.data.description,
        amount_cents: parsedBody.data.amount_cents,
        currency: parsedBody.data.currency,
        method: parsedBody.data.method,
        category_id: parsedBody.data.category_id,
        expense_date: new Date(parsedBody.data.expense_date),
        vendor: parsedBody.data.vendor,
        receipt_url: parsedBody.data.receipt_url,
        note: parsedBody.data.note,
        recorded_by_user_id: userId,
      },
      include: {
        category: { select: { id: true, name: true } },
        recorded_by_user: { select: { id: true, full_name: true, email: true } },
      },
    });

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid category_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create expense" }, { status: 500 });
  }
}
