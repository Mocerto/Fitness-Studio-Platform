-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'COACH', 'FRONTDESK');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'FROZEN', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('UNLIMITED', 'LIMITED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('CHECKED_IN', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'REFUNDED', 'VOID');

-- CreateTable
CREATE TABLE "studios" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "MemberStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaches" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_types" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "default_capacity" INTEGER,
    "duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "class_limit" INTEGER,
    "billing_period" "BillingPeriod" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "ContractStatus" NOT NULL,
    "plan_type_snapshot" "PlanType" NOT NULL,
    "class_limit_snapshot" INTEGER,
    "remaining_classes" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "paused_from" DATE,
    "paused_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "class_type_id" UUID NOT NULL,
    "coach_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "contract_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_studio_id_email_key" ON "users"("studio_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_studio_id_id_key" ON "users"("studio_id", "id");

-- CreateIndex
CREATE INDEX "members_studio_id_status_idx" ON "members"("studio_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "members_studio_id_id_key" ON "members"("studio_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_studio_id_user_id_key" ON "coaches"("studio_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_studio_id_id_key" ON "coaches"("studio_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "class_types_studio_id_name_key" ON "class_types"("studio_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "class_types_studio_id_id_key" ON "class_types"("studio_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_studio_id_name_key" ON "plans"("studio_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_studio_id_id_key" ON "plans"("studio_id", "id");

-- CreateIndex
CREATE INDEX "contracts_studio_id_member_id_status_idx" ON "contracts"("studio_id", "member_id", "status");

-- CreateIndex
CREATE INDEX "contracts_studio_id_start_date_idx" ON "contracts"("studio_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_studio_id_id_key" ON "contracts"("studio_id", "id");

-- CreateIndex
CREATE INDEX "sessions_studio_id_starts_at_idx" ON "sessions"("studio_id", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_studio_id_coach_id_starts_at_idx" ON "sessions"("studio_id", "coach_id", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_studio_id_class_type_id_starts_at_idx" ON "sessions"("studio_id", "class_type_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_studio_id_id_key" ON "sessions"("studio_id", "id");

-- CreateIndex
CREATE INDEX "attendance_studio_id_session_id_status_idx" ON "attendance"("studio_id", "session_id", "status");

-- CreateIndex
CREATE INDEX "attendance_studio_id_member_id_created_at_idx" ON "attendance"("studio_id", "member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_studio_id_session_id_member_id_key" ON "attendance"("studio_id", "session_id", "member_id");

-- CreateIndex
CREATE INDEX "payments_studio_id_paid_at_idx" ON "payments"("studio_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_studio_id_member_id_paid_at_idx" ON "payments"("studio_id", "member_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_studio_id_contract_id_idx" ON "payments"("studio_id", "contract_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_studio_id_user_id_fkey" FOREIGN KEY ("studio_id", "user_id") REFERENCES "users"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_types" ADD CONSTRAINT "class_types_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_studio_id_member_id_fkey" FOREIGN KEY ("studio_id", "member_id") REFERENCES "members"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_studio_id_plan_id_fkey" FOREIGN KEY ("studio_id", "plan_id") REFERENCES "plans"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studio_id_class_type_id_fkey" FOREIGN KEY ("studio_id", "class_type_id") REFERENCES "class_types"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studio_id_coach_id_fkey" FOREIGN KEY ("studio_id", "coach_id") REFERENCES "coaches"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studio_id_session_id_fkey" FOREIGN KEY ("studio_id", "session_id") REFERENCES "sessions"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studio_id_member_id_fkey" FOREIGN KEY ("studio_id", "member_id") REFERENCES "members"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studio_id_member_id_fkey" FOREIGN KEY ("studio_id", "member_id") REFERENCES "members"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studio_id_contract_id_fkey" FOREIGN KEY ("studio_id", "contract_id") REFERENCES "contracts"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studio_id_recorded_by_user_id_fkey" FOREIGN KEY ("studio_id", "recorded_by_user_id") REFERENCES "users"("studio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
