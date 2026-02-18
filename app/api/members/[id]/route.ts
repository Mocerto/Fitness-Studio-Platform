import { NextRequest, NextResponse } from "next/server";

import { idParamSchema, updateMemberSchema } from "@/lib/member-validation";
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
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updateMemberSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updateResult = await prisma.member.updateMany({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
      data: parsedBody.data,
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    const updatedMember = await prisma.member.findFirst({
      where: {
        id: parsedId.data,
        studio_id: studioId,
      },
    });

    return NextResponse.json({ data: updatedMember });
  } catch {
    return NextResponse.json({ message: "failed to update member" }, { status: 500 });
  }
}
