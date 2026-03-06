import { LeadSource, LeadStatus } from "@prisma/client";
import { z } from "zod";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const leadStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(LeadStatus),
);

export const leadSourceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(LeadSource),
);

export const createLeadSchema = z.object({
  first_name: z.string().trim().min(1, "first_name is required"),
  last_name: z.string().trim().min(1, "last_name is required"),
  email: z.preprocess(normalizeText, z.string().email("email must be valid").optional()),
  phone: z.preprocess(normalizeText, z.string().optional()),
  source: leadSourceSchema,
  status: leadStatusSchema.default(LeadStatus.NEW),
  interested_in: z.preprocess(normalizeText, z.string().optional()),
  notes: z.preprocess(normalizeText, z.string().optional()),
});

export const updateLeadSchema = z
  .object({
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
    email: z.preprocess(normalizeText, z.string().email().optional()),
    phone: z.preprocess(normalizeText, z.string().optional()),
    source: leadSourceSchema.optional(),
    status: leadStatusSchema.optional(),
    interested_in: z.preprocess(normalizeText, z.string().optional()),
    notes: z.preprocess(normalizeText, z.string().optional()),
    last_contacted_at: z.string().optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    "at least one field is required",
  );

export const idParamSchema = z.string().uuid("invalid id");
