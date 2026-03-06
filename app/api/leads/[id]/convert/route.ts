import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, MemberStatus, Prisma } from "@prisma/client";

import { idParamSchema } from "@/lib/lead-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

// POST /api/leads/[id]/convert
// Converts a lead to a member: creates a new Member and updates the lead status to CONVERTED.
export async function POST(
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

    if (lead.status === LeadStatus.CONVERTED) {
      return NextResponse.json({ message: "lead is already converted" }, { status: 400 });
    }

    // Create member and update lead in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          studio_id: studioId,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          status: MemberStatus.ACTIVE,
        },
      });

      const updatedLead = await tx.lead.update({
        where: { studio_id_id: { studio_id: studioId, id: lead.id } },
        data: {
          status: LeadStatus.CONVERTED,
          converted_member_id: member.id,
        },
      });

      return { lead: updatedLead, member };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "lead not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "failed to convert lead" }, { status: 500 });
  }
}
