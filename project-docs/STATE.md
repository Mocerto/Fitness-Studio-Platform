# STATE

## Current goal

Ship a working ERP MVP for a fitness studio.

## Current phase

Phase 1: ERP Core (B2B Admin)

## Current task (one sentence)

Translate the corrected MVP schema into Prisma models and the initial migration.

## What is done

- Reviewed ERP requirements in `ROADMAP.md` and tenant rules in `ARCHITECTURE.md`.
- Rebuilt `DATABASE.md` with complete MVP tables (including `payments`).
- Added relationship notes and required unique/index requirements.
- Added one-line rationale for each schema correction.

## What is in progress

- Mapping the updated database spec into Prisma models/enums.

## Blockers / Questions

- Decide whether "one active contract per member" should be enforced with a partial unique index (SQL) or service-layer validation.
- Confirm auth choice: Supabase Auth vs Clerk (does not block DB migration work).

## Next exact step (copy-pastable)

- Implement `prisma/schema.prisma` from `project-docs/DATABASE.md`, then run `npx prisma migrate dev --name init_mvp_schema`.

## Definition of Done for current task

- Prisma schema matches `project-docs/DATABASE.md`.
- Migration creates all required indexes/uniques, including `attendance(studio_id, session_id, member_id)`.
- Migration applies successfully to Postgres.
- Quick SQL check confirms tenant-scoped links and duplicate check-in prevention.
