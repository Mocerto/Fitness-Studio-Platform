import { ContractStatus } from "@prisma/client";
import { z } from "zod";

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format");

export const contractStatusQuerySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(ContractStatus),
);

export const uuidQuerySchema = z.string().uuid("must be a valid UUID");

export const createContractSchema = z
  .object({
    member_id: z.string().uuid("member_id must be a valid UUID"),
    plan_id: z.string().uuid("plan_id must be a valid UUID"),
    start_date: isoDateString,
    end_date: isoDateString.optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.end_date !== undefined && payload.end_date < payload.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "end_date must be >= start_date",
        path: ["end_date"],
      });
    }
  });

export const pauseContractSchema = z.object({
  paused_until: isoDateString.optional(),
});

export const contractIdParamSchema = z.string().uuid("invalid contract id");
