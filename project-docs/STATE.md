# STATE

## Current goal

Ship a working ERP MVP for a fitness studio.

## Current phase

Phase 1: ERP Core (B2B Admin)

## Current task (one sentence)

Implement Contracts (create + list) with plan snapshots.

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

## What is in progress

- Preparing Contracts implementation scope (create + list with plan snapshots).

## Blockers / Questions

- Decide whether to enforce "one active contract per member" with a partial unique index or service-layer validation.
- Confirm auth provider choice (Supabase Auth vs Clerk) before wiring role-based route guards.

## Next exact step (copy-pastable)

- Implement Contracts (create + list) with plan snapshots.

## Definition of Done for current task

- Contracts create endpoint stores `plan_type_snapshot` and `class_limit_snapshot` from selected plan.
- Contracts list endpoint returns tenant-scoped contracts with member + plan references.
- For limited plans, `remaining_classes` initializes from plan `class_limit`; for unlimited, it is null.
- Contract create/list enforce tenant isolation using `x-studio-id`.
- Minimal Contracts UI supports create form and list view without touching other modules.
