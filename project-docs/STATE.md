# STATE

## Current goal

Ship a working ERP MVP for a fitness studio.

## Current phase

Phase 1: ERP Core (B2B Admin)

## Current task (one sentence)

Implement Members CRUD (API + minimal UI) for ERP Core.

## What is done

- Reviewed ERP requirements in `ROADMAP.md` and tenant rules in `ARCHITECTURE.md`.
- Rebuilt `DATABASE.md` with complete MVP tables (including `payments`).
- Added relationship notes and required unique/index requirements.
- Added one-line rationale for each schema correction.
- Implemented complete Prisma schema in `prisma/schema.prisma` (enums, relations, uniques, indexes, attendance composite unique).
- Added Prisma v7 config in `prisma.config.ts` and aligned schema datasource usage.
- Ran Prisma formatting successfully via local CLI.
- Created and applied initial migration successfully: `prisma/migrations/20260218034221_init/migration.sql`.

## What is in progress

- Preparing the Members module implementation plan (tenant-safe API + minimal UI).

## Blockers / Questions

- Decide whether to enforce "one active contract per member" with a partial unique index or service-layer validation.
- Confirm auth provider choice (Supabase Auth vs Clerk) before wiring role-based route guards.

## Next exact step (copy-pastable)

- Implement Members CRUD (API + minimal UI).

## Definition of Done for current task

- Members list page shows tenant-scoped members with status.
- Create member form works and persists `first_name`, `last_name`, optional `email/phone`, `status`.
- Edit member updates allowed fields and preserves tenant isolation.
- Delete/deactivate action is defined and implemented safely for MVP.
- API layer validates input and prevents cross-tenant access.
