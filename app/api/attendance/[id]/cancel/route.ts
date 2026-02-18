import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

import { attendanceIdParamSchema } from "@/lib/attendance-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = getStudioId(request);
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = attendanceIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid attendance id" }, { status: 400 });
  }

  try {
    // Tenant-safe lookup — ensure attendance belongs to this studio
    const attendance = await prisma.attendance.findFirst({
      where: { id: parsedId.data, studio_id: studioId },
    });
    if (!attendance) {
      return NextResponse.json({ message: "attendance record not found" }, { status: 404 });
    }
    if (attendance.status === AttendanceStatus.CANCELLED) {
      return NextResponse.json({ message: "attendance is already cancelled" }, { status: 400 });
    }

    // MVP: do NOT restore remaining_classes on cancel.
    // Restoring would require re-fetching the contract and risking race conditions;
    // studio staff can manually adjust contracts if needed.
    const updated = await prisma.attendance.updateMany({
      where: { id: parsedId.data, studio_id: studioId },
      data: { status: AttendanceStatus.CANCELLED },
    });

    if (updated.count === 0) {
      return NextResponse.json({ message: "attendance record not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "attendance cancelled" });
  } catch {
    return NextResponse.json({ message: "failed to cancel attendance" }, { status: 500 });
  }
}
