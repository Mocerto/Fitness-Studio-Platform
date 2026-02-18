import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";

export const paymentMethodSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(PaymentMethod),
);

export const paymentStatusSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(PaymentStatus),
);

export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format");

export const uuidSchema = z.string().uuid("must be a valid UUID");

export const createPaymentSchema = z.object({
  member_id: z.string().uuid("member_id must be a valid UUID"),
  contract_id: z.string().uuid("contract_id must be a valid UUID").optional(),
  amount_cents: z
    .number()
    .int("amount_cents must be an integer")
    .gt(0, "amount_cents must be > 0"),
  currency: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "USD"),
    z.string().min(1, "currency is required"),
  ),
  method: paymentMethodSchema,
  status: paymentStatusSchema.default(PaymentStatus.RECORDED),
  paid_at: z.string().optional(),
  note: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : v),
    z.string().optional(),
  ),
});

// Individual query-param schemas used by the GET route
export const paymentListQuerySchema = {
  status: paymentStatusSchema,
  member_id: uuidSchema,
  contract_id: uuidSchema,
  from: isoDateStringSchema,
  to: isoDateStringSchema,
};
