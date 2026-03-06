import { InventoryTransactionType } from "@prisma/client";
import { z } from "zod";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const inventoryTransactionTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(InventoryTransactionType),
);

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.preprocess(normalizeText, z.string().optional()),
  sku: z.preprocess(normalizeText, z.string().optional()),
  category_id: z.preprocess(normalizeText, z.string().uuid("invalid category_id").optional()),
  price_cents: z.number().int().min(0, "price_cents must be >= 0"),
  cost_cents: z.number().int().min(0, "cost_cents must be >= 0").optional(),
  current_stock: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).optional(),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    description: z.preprocess(normalizeText, z.string().optional()),
    sku: z.preprocess(normalizeText, z.string().optional()),
    category_id: z.preprocess(normalizeText, z.string().uuid("invalid category_id").optional()),
    price_cents: z.number().int().min(0, "price_cents must be >= 0").optional(),
    cost_cents: z.number().int().min(0, "cost_cents must be >= 0").optional(),
    low_stock_threshold: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    "at least one field is required",
  );

export const createInventoryTransactionSchema = z
  .object({
    product_id: z.string().uuid("invalid product_id"),
    type: inventoryTransactionTypeSchema,
    quantity: z.number().int().min(1, "quantity must be > 0"),
    unit_cost_cents: z.number().int().min(0).optional(),
    note: z.preprocess(normalizeText, z.string().optional()),
  })
  .superRefine((payload, ctx) => {
    if (payload.type === InventoryTransactionType.PURCHASE && payload.unit_cost_cents == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unit_cost_cents is required for PURCHASE transactions",
        path: ["unit_cost_cents"],
      });
    }
  });

export const idParamSchema = z.string().uuid("invalid id");
