import { MemberStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { idParamSchema } from "@/lib/member-validation";
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
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const updateResult = await prisma.member.updateMany({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
      data: {
        status: MemberStatus.INACTIVE,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    const member = await prisma.member.findFirst({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
    });

    return NextResponse.json({ data: member });
  } catch {
    return NextResponse.json({ message: "failed to deactivate member" }, { status: 500 });
  }
}
