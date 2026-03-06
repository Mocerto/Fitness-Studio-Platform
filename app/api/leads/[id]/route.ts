import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { idParamSchema, updateLeadSchema } from "@/lib/lead-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid lead id" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
    });

    if (!lead) {
      return NextResponse.json({ message: "lead not found" }, { status: 404 });
    }

    return NextResponse.json({ data: lead });
  } catch {
    return NextResponse.json({ message: "failed to load lead" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid lead id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updateLeadSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = { ...parsedBody.data };
  if (parsedBody.data.last_contacted_at) {
    data.last_contacted_at = new Date(parsedBody.data.last_contacted_at);
  }

  try {
    const lead = await prisma.lead.update({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      data,
    });

    return NextResponse.json({ data: lead });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "lead not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "failed to update lead" }, { status: 500 });
  }
}
