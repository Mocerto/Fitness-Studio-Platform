import { PaymentMethod, PaymentStatus, PaymentType } from "@prisma/client";
import { z } from "zod";

export const paymentMethodSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(PaymentMethod),
);

export const paymentStatusSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(PaymentStatus),
);

export const paymentTypeSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(PaymentType),
);

export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format");

export const uuidSchema = z.string().uuid("must be a valid UUID");

export const createPaymentSchema = z
  .object({
    member_id: z.string().uuid("member_id must be a valid UUID"),
    payment_type: paymentTypeSchema.default(PaymentType.CONTRACT),
    contract_id: z.string().uuid("contract_id must be a valid UUID").optional(),
    product_id: z.string().uuid("product_id must be a valid UUID").optional(),
    product_qty: z.number().int().min(1, "product_qty must be >= 1").optional(),
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
  })
  .superRefine((payload, ctx) => {
    if (payload.payment_type === PaymentType.CONTRACT && !payload.contract_id) {
      // contract_id is optional for backwards compat but encouraged
    }
    if (payload.payment_type === PaymentType.PRODUCT_SALE) {
      if (!payload.product_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "product_id is required for PRODUCT_SALE payments",
          path: ["product_id"],
        });
      }
      if (!payload.product_qty || payload.product_qty < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "product_qty must be >= 1 for PRODUCT_SALE payments",
          path: ["product_qty"],
        });
      }
    }
  });

// Individual query-param schemas used by the GET route
export const paymentListQuerySchema = {
  status: paymentStatusSchema,
  payment_type: paymentTypeSchema,
  member_id: uuidSchema,
  contract_id: uuidSchema,
  from: isoDateStringSchema,
  to: isoDateStringSchema,
};
