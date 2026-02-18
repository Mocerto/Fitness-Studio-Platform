import { NextRequest, NextResponse } from "next/server";
import { ContractStatus, Prisma, PlanType } from "@prisma/client";

import {
  contractStatusQuerySchema,
  createContractSchema,
  uuidQuerySchema,
} from "@/lib/contract-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const statusQuery = request.nextUrl.searchParams.get("status");
  const memberIdQuery = request.nextUrl.searchParams.get("member_id");

  let statusFilter: { status?: ContractStatus } = {};
  if (statusQuery) {
    const parsed = contractStatusQuerySchema.safeParse(statusQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid status query, expected: ACTIVE, PAUSED, CANCELLED, EXPIRED" },
        { status: 400 },
      );
    }
    statusFilter = { status: parsed.data };
  }

  let memberIdFilter: { member_id?: string } = {};
  if (memberIdQuery) {
    const parsed = uuidQuerySchema.safeParse(memberIdQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "invalid member_id query, expected a UUID" },
        { status: 400 },
      );
    }
    memberIdFilter = { member_id: parsed.data };
  }

  try {
    const contracts = await prisma.contract.findMany({
      where: {
        studio_id: studioId,
        ...statusFilter,
        ...memberIdFilter,
      },
      include: {
        member: {
          select: { id: true, first_name: true, last_name: true },
        },
        plan: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ data: contracts });
  } catch {
    return NextResponse.json({ message: "failed to load contracts" }, { status: 500 });
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

  const parsedBody = createContractSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { member_id, plan_id, start_date, end_date } = parsedBody.data;

  try {
    const member = await prisma.member.findFirst({
      where: { id: member_id, studio_id: studioId },
    });
    if (!member) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    const plan = await prisma.plan.findFirst({
      where: { id: plan_id, studio_id: studioId },
    });
    if (!plan) {
      return NextResponse.json({ message: "plan not found" }, { status: 404 });
    }
    if (!plan.is_active) {
      return NextResponse.json({ message: "plan is not active" }, { status: 400 });
    }
    if (plan.type === PlanType.LIMITED && (plan.class_limit == null || plan.class_limit <= 0)) {
      return NextResponse.json(
        { message: "plan is misconfigured: LIMITED plan has no valid class_limit" },
        { status: 400 },
      );
    }

    const remaining_classes = plan.type === PlanType.LIMITED ? plan.class_limit : null;

    const contract = await prisma.contract.create({
      data: {
        studio_id: studioId,
        member_id,
        plan_id,
        status: ContractStatus.ACTIVE,
        plan_type_snapshot: plan.type,
        class_limit_snapshot: plan.class_limit,
        remaining_classes,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        plan: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "invalid studio_id, member_id, or plan_id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "failed to create contract" }, { status: 500 });
  }
}
