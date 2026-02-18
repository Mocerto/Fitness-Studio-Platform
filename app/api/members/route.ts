import { NextRequest, NextResponse } from "next/server";
import { MemberStatus, Prisma } from "@prisma/client";

import { createMemberSchema, memberStatusSchema } from "@/lib/member-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const statusQuery = request.nextUrl.searchParams.get("status");
  let statusFilter: { status?: MemberStatus } = {};

  if (statusQuery) {
    const parsedStatus = memberStatusSchema.safeParse(statusQuery);
    if (!parsedStatus.success) {
      return NextResponse.json(
        { message: "invalid status query", errors: parsedStatus.error.flatten() },
        { status: 400 },
      );
    }
    statusFilter = { status: parsedStatus.data };
  }

  try {
    const members = await prisma.member.findMany({
      where: {
        studio_id: studioId,
        ...statusFilter,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ data: members });
  } catch {
    return NextResponse.json({ message: "failed to load members" }, { status: 500 });
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

  const parsedBody = createMemberSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const member = await prisma.member.create({
      data: {
        studio_id: studioId,
        first_name: parsedBody.data.first_name,
        last_name: parsedBody.data.last_name,
        email: parsedBody.data.email,
        phone: parsedBody.data.phone,
        status: parsedBody.data.status,
      },
    });

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid studio_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create member" }, { status: 500 });
  }
}
