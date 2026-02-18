#   STATE

## Current goal

Ship a working ERP MVP for a fitness studio.

## Current phase

Phase 1: ERP Core (B2B Admin)

## Current task (one sentence)

Add Supabase Auth + role-based route guards.

## What is done

- Reviewed ERP requirements in `ROADMAP.md` and tenant rules in `ARCHITECTURE.md`.
- Rebuilt `DATABASE.md` with complete MVP tables (including `payments`).
- Added relationship notes and required unique/index requirements.
- Added one-line rationale for each schema correction.
- Implemented complete Prisma schema in `prisma/schema.prisma` (enums, relations, uniques, indexes, attendance composite unique).
- Added Prisma v7 config in `prisma.config.ts` and aligned schema datasource usage.
- Ran Prisma formatting successfully via local CLI.
- Created and applied initial migration successfully: `prisma/migrations/20260218034221_init/migration.sql`.
- Cleaned `.gitignore` to exclude local/build/cache artifacts (kept Prisma migrations tracked).
- Implemented Members API routes with tenant isolation and zod validation:

  - `GET /api/members`
  - `POST /api/members`
  - `PATCH /api/members/:id`
  - `POST /api/members/:id/deactivate`
- Added minimal Members UI pages:

  - `/members` list + status filter
  - `/members/new` create form
  - `/members/[id]/edit` update + deactivate
- Added Prisma singleton helper in `lib/prisma.ts` and configured Prisma v7 PostgreSQL adapter.
- Verified app compile/build (`npm run build`) and dev runtime startup for Members routes/pages.
- Implemented Plans API routes with tenant isolation and zod validation:

  - `GET /api/plans`
  - `POST /api/plans`
  - `PATCH /api/plans/:id`
  - `POST /api/plans/:id/deactivate`
- Added minimal Plans UI pages:

  - `/plans` list + active filter
  - `/plans/new` create form
  - `/plans/[id]/edit` update + deactivate
- Added `lib/plan-validation.ts` with conditional rules for `type` and `class_limit`.
- Verified app compiles with Plans module (`npm run build`).
- QA audit of Plans module completed (2026-02-17).
- Plans QA bugs fixed (MEDIUM):

  - `PATCH /api/plans/:id` LIMITED -> UNLIMITED transition now forces merged `nextClassLimit = null` before validation.
  - Plans UI fetch calls now use try/catch and always reset loading/submitting in finally.
- Implemented Contracts module with tenant isolation, plan snapshots, and correct `remaining_classes` init:

  - `GET /api/contracts` — list with optional `status` + `member_id` filters, includes member + plan relations
  - `POST /api/contracts` — validates member/plan ownership, enforces LIMITED class_limit sanity, sets snapshots
  - `POST /api/contracts/:id/pause` — ACTIVE-only guard, sets paused_from=today, optional paused_until
  - `POST /api/contracts/:id/cancel` — non-CANCELLED guard, sets end_date=today if unset
  - Added `lib/contract-validation.ts` (Zod schemas for create, pause, query params)
  - Minimal UI: `/contracts` list (status + member_id filters, inline pause/cancel buttons), `/contracts/new` create form
  - All UI fetch calls use try/catch + finally (pattern consistent with QA fixes)
  - Verified app compiles cleanly (`npm run build`), 12 routes registered
- Implemented Payments module with tenant isolation and member/contract cross-validation:

  - `GET /api/payments` — list with optional filters: status, member_id, contract_id, from/to (paid_at range); includes member + contract info
  - `POST /api/payments` — verifies member ownership, verifies contract ownership + contract.member_id matches; defaults currency=USD, status=RECORDED, paid_at=now
  - Added `lib/payment-validation.ts` (Zod schemas: createPaymentSchema, paymentMethodSchema, paymentStatusSchema, isoDateStringSchema, uuidSchema, paymentListQuerySchema)
  - Minimal UI: `/payments` list (status/member_id/contract_id/from-to filters), `/payments/new` create form with live member dropdown + contract dropdown (fetched per member)
  - Amount entered in dollars, converted to cents on submit; displayed as formatted currency in list
  - All fetch calls use try/catch + finally pattern
  - Verified app compiles cleanly (`npm run build`), 22 routes registered
- QA audit of Payments module completed (2026-02-18):

  - Tenant isolation checks: PASS (no cross-tenant read/create path found).
  - No HIGH issues found.
  - Found MEDIUM issues in date validation and paid_at input validation (details in QA report).
- Payments QA MEDIUM fixes applied:

  - `GET /api/payments`: `from`/`to` Date objects now checked with `Number.isNaN(date.getTime())` after construction; invalid calendar dates (e.g. Feb 30) return 400 instead of 500.
  - `POST /api/payments`: `paid_at` validated with `Number.isNaN` before `prisma.payment.create`; invalid strings return 400 instead of a Prisma runtime crash.
  - `/payments/new` UI: replaced `parseFloat + Math.round` with integer-only `dollarsToCents()` helper (splits on `.`, rejects >2 decimal places, no floating-point arithmetic).
- Implemented Sessions module with tenant isolation, class_type/coach cross-validation, and cancel transition:

  - `GET /api/class-types` — read-only, tenant-scoped, active only, ordered by name (supports session dropdowns)
  - `GET /api/coaches` — read-only, tenant-scoped, active only, ordered by name (supports session dropdowns)
  - `GET /api/sessions` — list with optional filters: status, class_type_id, coach_id, from/to (starts_at range, NaN-guarded); ordered starts_at ASC; includes class_type + coach
  - `POST /api/sessions` — verifies class_type + coach ownership; validates ends_at > starts_at; defaults status=SCHEDULED
  - `PATCH /api/sessions/:id` — tenant-safe; re-verifies class_type/coach on change; merges starts_at/ends_at and validates ordering before write
  - `POST /api/sessions/:id/cancel` — SCHEDULED-only guard (rejects already-CANCELLED); updateMany with studio_id in WHERE
  - Added `lib/session-validation.ts` (isoDateTimeSchema via superRefine NaN check, createSessionSchema, updateSessionSchema, sessionListQuerySchema)
  - Minimal UI: `/sessions` list (status/from-to filters, inline Cancel button disabled for already-cancelled), `/sessions/new` create form with live class-type + coach dropdowns, capacity auto-filled from class type default
  - Nav updated: Contracts, Payments, Sessions added to layout header
  - Verified app compiles cleanly (`npm run build`), 29 routes registered
- Implemented Attendance Check-in MVP with tenant isolation, contract validation, and atomic transactions:

  - `GET /api/attendance` — list with optional filters: status, session_id, member_id; ordered created_at DESC; includes member + session.class_type
  - `POST /api/attendance/check-in` — verifies session (not CANCELLED), member (ACTIVE), ACTIVE contract; for LIMITED plans checks remaining_classes > 0; `prisma.$transaction` atomically creates attendance + decrements remaining_classes; P2002 unique constraint catch returns 200 with `already_checked_in: true` (idempotent)
  - `POST /api/attendance/:id/cancel` — tenant-safe; rejects already-CANCELLED; `updateMany` with studio_id in WHERE; MVP: does NOT restore remaining_classes (documented in code)
  - Added `lib/attendance-validation.ts` (attendanceStatusSchema, uuidSchema, checkInSchema, attendanceIdParamSchema, attendanceListQuerySchema)
  - Minimal UI: `/check-in` — session dropdown (SCHEDULED only), ACTIVE member list with name search, per-member check-in button with in-flight + already-checked-in state; `/attendance` list with status/session_id/member_id filters + inline Cancel button
  - Nav updated: Check-In, Attendance added to layout header
  - Verified app compiles cleanly (`npm run build`), 34 routes registered
- Implemented Analytics Dashboard:

  - `GET /api/dashboard` — tenant-scoped; optional `from`/`to` (YYYY-MM-DD, default today); NaN-guarded; `to` includes end-of-day; returns: `revenue_cents_total` (RECORDED payments), `payments_count`, `attendance_checkins_count` (keyed on `checked_in_at`), `attendance_cancelled_count` (keyed on `created_at`), `active_members_count` (snapshot), `sessions_scheduled_count`, `sessions_cancelled_count`; all 7 queries run in `Promise.all`
  - `/dashboard` UI — KPI cards: Revenue (USD formatted), Check-ins, Active Members, Sessions Scheduled; from/to date inputs defaulting to today; Refresh button; try/catch/finally pattern; studioId from localStorage
  - Nav updated: Dashboard link added after Home
  - Verified app compiles cleanly (`npm run build`), 36 routes registered

- Full-system QA + architecture audit completed (2026-02-18):

  - Tenant isolation across API routes: PASS (no direct cross-tenant read/mutate path found).
  - HIGH issues found: LIMITED check-in decrement can race below zero; ACTIVE contract selection in check-in is nondeterministic when multiple ACTIVE contracts exist.
  - MEDIUM issues found: several UI flows (Members/Check-In/Attendance/Sessions) have incomplete network error handling patterns.
- Attendance HIGH fixes applied (2026-02-18):

  - `POST /api/attendance/check-in` now loads all ACTIVE contracts per `(studio_id, member_id)`, returns `400 no active contract` for 0 and `409 multiple active contracts` for >1.
  - LIMITED decrement is now concurrency-safe via transactional `updateMany` with `remaining_classes > 0`; if affected rows != 1, request returns `400 no classes left`.
  - Duplicate check-in idempotency preserved: unique conflict (`P2002`) returns `200 already_checked_in=true` and no decrement is applied.
- UI robustness fixes applied (2026-02-18):

  - `/check-in` now uses user-provided `studio_id` (localStorage pattern), validates non-OK API responses, and renders nullable coach safely (`coach?.name`).
  - Members UI (`/members`, `/members/new`, `/members/[id]/edit`) now wraps fetch/submit/deactivate flows in `try/catch/finally` with guaranteed loading/submitting reset and alert on error.
  - `/sessions/new` now surfaces class-types/coaches loading failures with visible error message + alert.

## What is in progress

- None.

## Blockers / Questions

- Decide whether to enforce "one active contract per member" with a partial unique index or service-layer validation.
- Confirm auth provider choice (Supabase Auth vs Clerk) before wiring role-based route guards.
- Decision pending: restore `remaining_classes` on attendance cancellation? MVP does NOT restore (documented in code). Recommended next small improvement after auth.

## Next exact step (copy-pastable)

- Add Supabase Auth + role-based route guards (confirm provider choice first).

## Definition of Done for current task

- Auth provider chosen (Supabase Auth or Clerk).
- Login/logout flow working.
- `x-studio-id` resolved from authenticated session (not entered manually).
- Role-based guards block unauthorized access to API routes and UI pages.
