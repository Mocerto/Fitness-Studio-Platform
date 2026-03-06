import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createExpenseCategorySchema } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET() {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { studio_id: studioId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: categories });
  } catch {
    return NextResponse.json({ message: "failed to load expense categories" }, { status: 500 });
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

  const parsedBody = createExpenseCategorySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const category = await prisma.expenseCategory.create({
      data: {
        studio_id: studioId,
        name: parsedBody.data.name,
      },
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "category already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "failed to create category" }, { status: 500 });
  }
}
