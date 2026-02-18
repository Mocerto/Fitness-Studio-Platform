import { MemberStatus } from "@prisma/client";
import { z } from "zod";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const memberStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(MemberStatus),
);

export const createMemberSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "first_name is required"),
  last_name: z
    .string()
    .trim()
    .min(1, "last_name is required"),
  email: z.preprocess(
    normalizeText,
    z.string().email("email must be valid").optional(),
  ),
  phone: z.preprocess(normalizeText, z.string().optional()),
  status: memberStatusSchema.default(MemberStatus.ACTIVE),
});

export const updateMemberSchema = z
  .object({
    first_name: z.string().trim().min(1, "first_name cannot be empty").optional(),
    last_name: z.string().trim().min(1, "last_name cannot be empty").optional(),
    email: z.preprocess(
      normalizeText,
      z.string().email("email must be valid").optional(),
    ),
    phone: z.preprocess(normalizeText, z.string().optional()),
    status: memberStatusSchema.optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    "at least one field is required",
  );

export const idParamSchema = z.string().uuid("invalid member id");
