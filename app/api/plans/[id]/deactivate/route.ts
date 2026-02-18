import { NextRequest, NextResponse } from "next/server";

import { planIdParamSchema } from "@/lib/plan-validation";
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
  const parsedId = planIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const updated = await prisma.plan.updateMany({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
      data: {
        is_active: false,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ message: "plan not found" }, { status: 404 });
    }

    const plan = await prisma.plan.findFirst({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
    });

    return NextResponse.json({ data: plan });
  } catch {
    return NextResponse.json({ message: "failed to deactivate plan" }, { status: 500 });
  }
}
