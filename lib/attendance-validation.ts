import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

export const attendanceStatusSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(AttendanceStatus),
);

export const uuidSchema = z.string().uuid("must be a valid UUID");

export const checkInSchema = z.object({
  session_id: z.string().uuid("session_id must be a valid UUID"),
  member_id: z.string().uuid("member_id must be a valid UUID"),
});

export const attendanceIdParamSchema = z.string().uuid("invalid attendance id");

// Individual query-param schemas used by the GET route
export const attendanceListQuerySchema = {
  session_id: uuidSchema,
  member_id: uuidSchema,
  status: attendanceStatusSchema,
};
