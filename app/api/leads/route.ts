import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, Prisma } from "@prisma/client";

import { createLeadSchema, leadSourceSchema, leadStatusSchema } from "@/lib/lead-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const params = request.nextUrl.searchParams;
  const where: Prisma.LeadWhereInput = { studio_id: studioId };

  const statusQuery = params.get("status");
  if (statusQuery) {
    const parsed = leadStatusSchema.safeParse(statusQuery);
    if (!parsed.success) {
      return NextResponse.json({ message: "invalid status query" }, { status: 400 });
    }
    where.status = parsed.data;
  }

  const sourceQuery = params.get("source");
  if (sourceQuery) {
    const parsed = leadSourceSchema.safeParse(sourceQuery);
    if (!parsed.success) {
      return NextResponse.json({ message: "invalid source query" }, { status: 400 });
    }
    where.source = parsed.data;
  }

  try {
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    // Compute pipeline summary
    const pipeline = leads.reduce(
      (acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalLeads = leads.length;
    const converted = leads.filter((l) => l.status === LeadStatus.CONVERTED).length;
    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
      data: leads,
      summary: { total: totalLeads, converted, conversion_rate: conversionRate, pipeline },
    });
  } catch {
    return NextResponse.json({ message: "failed to load leads" }, { status: 500 });
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

  const parsedBody = createLeadSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        studio_id: studioId,
        first_name: parsedBody.data.first_name,
        last_name: parsedBody.data.last_name,
        email: parsedBody.data.email,
        phone: parsedBody.data.phone,
        source: parsedBody.data.source,
        status: parsedBody.data.status,
        interested_in: parsedBody.data.interested_in,
        notes: parsedBody.data.notes,
      },
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid studio_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create lead" }, { status: 500 });
  }
}
