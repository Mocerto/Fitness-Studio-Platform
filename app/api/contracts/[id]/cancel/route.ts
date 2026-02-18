import { NextRequest, NextResponse } from "next/server";
import { ContractStatus } from "@prisma/client";

import { contractIdParamSchema } from "@/lib/contract-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await context.params;
  const parsedId = contractIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const existing = await prisma.contract.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });

    if (!existing) {
      return NextResponse.json({ message: "contract not found" }, { status: 404 });
    }

    if (existing.status === ContractStatus.CANCELLED) {
      return NextResponse.json({ message: "contract is already cancelled" }, { status: 400 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.contract.updateMany({
      where: { id: parsedId.data, studio_id: studioId },
      data: {
        status: ContractStatus.CANCELLED,
        end_date: existing.end_date ?? today,
      },
    });

    const contract = await prisma.contract.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });

    return NextResponse.json({ data: contract });
  } catch {
    return NextResponse.json({ message: "failed to cancel contract" }, { status: 500 });
  }
}
