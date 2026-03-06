import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { idParamSchema, updateExpenseSchema } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid expense id" }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.findUnique({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      include: {
        category: { select: { id: true, name: true } },
        recorded_by_user: { select: { id: true, full_name: true, email: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ message: "expense not found" }, { status: 404 });
    }

    return NextResponse.json({ data: expense });
  } catch {
    return NextResponse.json({ message: "failed to load expense" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid expense id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updateExpenseSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = { ...parsedBody.data };
  if (parsedBody.data.expense_date) {
    data.expense_date = new Date(parsedBody.data.expense_date);
  }

  try {
    const expense = await prisma.expense.update({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      data,
      include: {
        category: { select: { id: true, name: true } },
        recorded_by_user: { select: { id: true, full_name: true, email: true } },
      },
    });

    return NextResponse.json({ data: expense });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "expense not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "failed to update expense" }, { status: 500 });
  }
}
