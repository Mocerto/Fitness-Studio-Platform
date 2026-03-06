import { ExpenseStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const paymentMethodSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(PaymentMethod),
);

export const expenseStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(ExpenseStatus),
);

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "description is required"),
  amount_cents: z.number().int().min(1, "amount_cents must be > 0"),
  currency: z.string().trim().min(1).default("USD"),
  method: paymentMethodSchema,
  category_id: z.preprocess(normalizeText, z.string().uuid("invalid category_id").optional()),
  expense_date: z.string().min(1, "expense_date is required"),
  vendor: z.preprocess(normalizeText, z.string().optional()),
  receipt_url: z.preprocess(normalizeText, z.string().url("invalid receipt URL").optional()),
  note: z.preprocess(normalizeText, z.string().optional()),
});

export const updateExpenseSchema = z
  .object({
    description: z.string().trim().min(1, "description cannot be empty").optional(),
    amount_cents: z.number().int().min(1, "amount_cents must be > 0").optional(),
    currency: z.string().trim().min(1).optional(),
    method: paymentMethodSchema.optional(),
    category_id: z.preprocess(normalizeText, z.string().uuid("invalid category_id").optional()),
    expense_date: z.string().optional(),
    vendor: z.preprocess(normalizeText, z.string().optional()),
    receipt_url: z.preprocess(normalizeText, z.string().url("invalid receipt URL").optional()),
    note: z.preprocess(normalizeText, z.string().optional()),
    status: expenseStatusSchema.optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    "at least one field is required",
  );

export const idParamSchema = z.string().uuid("invalid id");
