import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  createPlanSchema,
  isActiveQuerySchema,
  validatePlanTypeClassLimit,
} from "@/lib/plan-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const isActiveQuery = request.nextUrl.searchParams.get("is_active");
  let activeFilter: { is_active?: boolean } = {};

  if (isActiveQuery !== null) {
    const parsed = isActiveQuerySchema.safeParse(isActiveQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid is_active query, expected true or false" },
        { status: 400 },
      );
    }
    activeFilter = { is_active: parsed.data };
  }

  try {
    const plans = await prisma.plan.findMany({
      where: {
        studio_id: studioId,
        ...activeFilter,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ data: plans });
  } catch {
    return NextResponse.json({ message: "failed to load plans" }, { status: 500 });
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

  const parsedBody = createPlanSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const classLimitError = validatePlanTypeClassLimit({
    type: parsedBody.data.type,
    class_limit: parsedBody.data.class_limit ?? null,
  });
  if (classLimitError) {
    return NextResponse.json({ message: classLimitError }, { status: 400 });
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        studio_id: studioId,
        name: parsedBody.data.name,
        type: parsedBody.data.type,
        class_limit:
          parsedBody.data.type === "UNLIMITED"
            ? null
            : (parsedBody.data.class_limit ?? null),
        billing_period: parsedBody.data.billing_period,
        price_cents: parsedBody.data.price_cents,
        is_active: parsedBody.data.is_active,
      },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "plan name already exists in this studio" },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid studio_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create plan" }, { status: 500 });
  }
}
