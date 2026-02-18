import { NextRequest, NextResponse } from "next/server";
import { ContractStatus } from "@prisma/client";

import { contractIdParamSchema, pauseContractSchema } from "@/lib/contract-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await context.params;
  const parsedId = contractIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = pauseContractSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.contract.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });

    if (!existing) {
      return NextResponse.json({ message: "contract not found" }, { status: 404 });
    }

    if (existing.status !== ContractStatus.ACTIVE) {
      return NextResponse.json(
        { message: "only ACTIVE contracts can be paused" },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.contract.updateMany({
      where: { id: parsedId.data, studio_id: studioId },
      data: {
        status: ContractStatus.PAUSED,
        paused_from: today,
        paused_until: parsedBody.data.paused_until
          ? new Date(parsedBody.data.paused_until)
          : null,
      },
    });

    const contract = await prisma.contract.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });

    return NextResponse.json({ data: contract });
  } catch {
    return NextResponse.json({ message: "failed to pause contract" }, { status: 500 });
  }
}
