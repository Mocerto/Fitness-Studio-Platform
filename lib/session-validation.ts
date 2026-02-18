import { SessionStatus } from "@prisma/client";
import { z } from "zod";

// For query-param date filters (YYYY-MM-DD only)
export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format");

// For body datetime fields — accepts any string that produces a valid Date
export const isoDateTimeSchema = z.string().superRefine((val, ctx) => {
  if (Number.isNaN(new Date(val).getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "must be a valid ISO datetime string",
    });
  }
});

export const sessionStatusSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(SessionStatus),
);

export const uuidSchema = z.string().uuid("must be a valid UUID");

export const createSessionSchema = z
  .object({
    class_type_id: z.string().uuid("class_type_id must be a valid UUID"),
    coach_id: z.string().uuid("coach_id must be a valid UUID").optional(),
    starts_at: isoDateTimeSchema,
    ends_at: isoDateTimeSchema.optional(),
    capacity: z
      .number()
      .int("capacity must be an integer")
      .gt(0, "capacity must be > 0"),
    status: sessionStatusSchema.default(SessionStatus.SCHEDULED),
  })
  .superRefine((payload, ctx) => {
    if (payload.ends_at !== undefined) {
      if (new Date(payload.ends_at) <= new Date(payload.starts_at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ends_at must be after starts_at",
          path: ["ends_at"],
        });
      }
    }
  });

export const updateSessionSchema = z
  .object({
    class_type_id: z.string().uuid("class_type_id must be a valid UUID").optional(),
    coach_id: z.string().uuid("coach_id must be a valid UUID").optional(),
    starts_at: isoDateTimeSchema.optional(),
    ends_at: isoDateTimeSchema.optional(),
    capacity: z
      .number()
      .int("capacity must be an integer")
      .gt(0, "capacity must be > 0")
      .optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((v) => v !== undefined),
    "at least one field is required",
  );

export const sessionIdParamSchema = z.string().uuid("invalid session id");

// Exported for reference — individual schemas are used directly in the route
export const sessionListQuerySchema = {
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  status: sessionStatusSchema,
  class_type_id: uuidSchema,
  coach_id: uuidSchema,
};
