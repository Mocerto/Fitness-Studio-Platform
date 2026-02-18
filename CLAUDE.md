# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant fitness studio ERP MVP. A single Next.js fullstack app (not a monorepo) serving 8 business domains via REST APIs and server-rendered pages.

## Session Start Rule

**Always read `project-docs/STATE.md` before doing any work.** It tells you the current task, what's done, what's in progress, and the exact next step. Update it after any meaningful change.

## Commands

```bash
npm run dev              # Start dev server at localhost:3000
npm run build            # Production build (use this to validate TypeScript)
npx prisma migrate dev   # Apply schema changes and generate client
npx prisma generate      # Regenerate Prisma client after schema edits
npx prisma format        # Format schema.prisma
npm run prisma:migrate:init  # Create the initial migration (only once)
```

No test runner is configured — use `npm run build` for compile-time validation.

## Architecture

### Multi-Tenancy (Critical)

Every table carries `studio_id`. Tenant is resolved from the `x-studio-id` HTTP header in every API route. All Prisma queries **must** include a `where: { studio_id }` clause. Composite foreign keys `(studio_id, id)` enforce cross-tenant data isolation at the DB level.

The helper is at `lib/tenant.ts` — call `getStudioId(request)` at the start of every route handler. If it returns `null`, return `missingStudioHeaderResponse()` (yields 401).

### Domain Structure

Each domain follows a consistent pattern:
- `app/api/[domain]/route.ts` — GET (list) + POST (create)
- `app/api/[domain]/[id]/route.ts` — GET, PUT, DELETE
- `app/api/[domain]/[id]/[action]/route.ts` — domain-specific actions (e.g., `/pause`, `/cancel`, `/check-in`)
- `lib/[domain]-validation.ts` — Zod schemas for request validation
- `app/[domain]/page.tsx` — list page (Server Component wrapping a `*-client.tsx`)
- `app/[domain]/new/page.tsx` — create form

### API Conventions

- Success responses always use `{ data: ... }` envelope.
- Monetary amounts are stored in cents (`price_cents`, `amount_cents`). UI converts dollars → cents on submit (integer-only, no floating-point arithmetic).
- Date range query params (`from`, `to`, `starts_at`) must be NaN-guarded with `Number.isNaN(date.getTime())` after `new Date(str)` — invalid dates return 400.

### Key Business Rules

- **Attendance check-in** (`app/api/attendance/check-in/route.ts`): Validates session (not CANCELLED), member (ACTIVE), and exactly one ACTIVE contract. Limited plans decrement `remaining_classes` atomically via `prisma.$transaction`. Duplicate check-ins are idempotent (P2002 catch → returns `already_checked_in: true` with 200).
- **Attendance cancellation does NOT restore `remaining_classes`** (MVP decision, documented in code).
- **Contracts**: Snapshot `remaining_classes` from plan at creation for LIMITED plans. Contract status lifecycle: ACTIVE → PAUSED → CANCELLED. There is no edit page for contracts — only create + pause/cancel actions.
- **Members**: Status: ACTIVE / FROZEN / INACTIVE.
- **Class-types and coaches** (`app/api/class-types/route.ts`, `app/api/coaches/route.ts`): Read-only endpoints used for dropdowns — no CRUD UI exists yet.

### Prisma Client

Use the singleton from `lib/prisma.ts` (do not instantiate `new PrismaClient()` elsewhere). The client uses `@prisma/adapter-pg` with the native `pg` driver.

### Frontend

Client components (forms, state) are suffixed `*-client.tsx` and live alongside their page route. Data fetching uses `fetch` with try/catch/finally and explicit loading/error states — no external data-fetching library.

## Project Documentation

Read these before adding new features:

| File | Purpose |
|---|---|
| `project-docs/STATE.md` | Current task status — **read and update this when starting/finishing work** |
| `project-docs/ARCHITECTURE.md` | Core tech stack and multi-tenant rules |
| `project-docs/DATABASE.md` | Full schema spec: models, enums, indexes, constraints |
| `project-docs/RULES.md` | Development conventions |
| `project-docs/ROADMAP.md` | MVP phases and upcoming features |
| `project-docs/AGENTS.md` | AI agent role definitions (Architect / DB / Backend / Frontend / QA) |

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript 5** (strict mode)
- **Prisma 7** + **PostgreSQL** (via `@prisma/adapter-pg`)
- **Zod 4** for runtime validation
- Path alias `@/*` maps to the project root
