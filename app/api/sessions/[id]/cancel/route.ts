import { NextRequest, NextResponse } from "next/server";
import { SessionStatus } from "@prisma/client";

import { sessionIdParamSchema } from "@/lib/session-validation";
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
  const parsedId = sessionIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: parsedId.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const existing = await prisma.session.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });

    if (!existing) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }

    if (existing.status === SessionStatus.CANCELLED) {
      return NextResponse.json({ message: "session is already cancelled" }, { status: 400 });
    }

    await prisma.session.updateMany({
      where: { id: parsedId.data, studio_id: studioId },
      data: { status: SessionStatus.CANCELLED },
    });

    const session = await prisma.session.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
      include: {
        class_type: { select: { id: true, name: true } },
        coach: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: session });
  } catch {
    return NextResponse.json({ message: "failed to cancel session" }, { status: 500 });
  }
}
