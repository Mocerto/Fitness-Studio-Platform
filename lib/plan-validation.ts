import { BillingPeriod, PlanType } from "@prisma/client";
import { z } from "zod";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const planTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(PlanType),
);

export const billingPeriodSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(BillingPeriod),
);

export const isActiveQuerySchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return value;
  },
  z.boolean(),
);

const conditionalClassLimitRules = (
  payload: { type: PlanType; class_limit?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (payload.type === PlanType.LIMITED) {
    if (payload.class_limit == null || payload.class_limit <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "class_limit must be > 0 when type is LIMITED",
        path: ["class_limit"],
      });
    }
  }

  if (payload.type === PlanType.UNLIMITED && payload.class_limit != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "class_limit must be null/undefined when type is UNLIMITED",
      path: ["class_limit"],
    });
  }
};

export function validatePlanTypeClassLimit(payload: {
  type: PlanType;
  class_limit?: number | null;
}): string | null {
  if (payload.type === PlanType.LIMITED) {
    if (payload.class_limit == null || payload.class_limit <= 0) {
      return "class_limit must be > 0 when type is LIMITED";
    }
  }

  if (payload.type === PlanType.UNLIMITED && payload.class_limit != null) {
    return "class_limit must be null/undefined when type is UNLIMITED";
  }

  return null;
}

export const createPlanSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "name is required"),
    type: planTypeSchema,
    class_limit: z.preprocess(
      (value) => {
        if (value === "" || value === null || value === undefined) {
          return undefined;
        }
        return value;
      },
      z.number().int("class_limit must be an integer").optional(),
    ),
    billing_period: billingPeriodSchema,
    price_cents: z
      .number()
      .int("price_cents must be an integer")
      .gt(0, "price_cents must be > 0"),
    is_active: z.boolean().optional().default(true),
  })
  .superRefine(conditionalClassLimitRules);

export const updatePlanSchema = z
  .object({
    name: z.preprocess(normalizeText, z.string().optional()),
    type: planTypeSchema.optional(),
    class_limit: z.preprocess(
      (value) => {
        if (value === "" || value === null || value === undefined) {
          return undefined;
        }
        return value;
      },
      z.number().int("class_limit must be an integer").optional(),
    ),
    billing_period: billingPeriodSchema.optional(),
    price_cents: z
      .number()
      .int("price_cents must be an integer")
      .gt(0, "price_cents must be > 0")
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    "at least one field is required",
  )
  .superRefine((payload, ctx) => {
    if (payload.type === undefined) {
      return;
    }
    conditionalClassLimitRules(
      { type: payload.type, class_limit: payload.class_limit },
      ctx,
    );
  });

export const planIdParamSchema = z.string().uuid("invalid plan id");
