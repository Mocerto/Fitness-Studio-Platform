import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { idParamSchema } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function PATCH(
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
    const expense = await prisma.expense.update({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      data: { status: "VOID" },
    });

    return NextResponse.json({ data: expense });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "expense not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "failed to void expense" }, { status: 500 });
  }
}
