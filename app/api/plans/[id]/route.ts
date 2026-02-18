import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  planIdParamSchema,
  updatePlanSchema,
  validatePlanTypeClassLimit,
} from "@/lib/plan-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await context.params;
  const parsedId = planIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updatePlanSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
    });

    if (!existingPlan) {
      return NextResponse.json({ message: "plan not found" }, { status: 404 });
    }

    const nextType = parsedBody.data.type ?? existingPlan.type;
    const nextClassLimit =
      parsedBody.data.class_limit !== undefined
        ? parsedBody.data.class_limit
        : existingPlan.class_limit;

    const classLimitError = validatePlanTypeClassLimit({
      type: nextType,
      class_limit: nextClassLimit,
    });
    if (classLimitError) {
      return NextResponse.json({ message: classLimitError }, { status: 400 });
    }

    const updated = await prisma.plan.updateMany({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
      data: {
        ...parsedBody.data,
        class_limit:
          nextType === "UNLIMITED"
            ? null
            : (parsedBody.data.class_limit ?? existingPlan.class_limit),
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
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "plan name already exists in this studio" },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "failed to update plan" }, { status: 500 });
  }
}
