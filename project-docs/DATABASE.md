# DATABASE (MVP schema)

## Scope

- Multi-tenant ERP schema for Fitness Studio MVP.
- Every tenant-owned table carries `studio_id`.
- IDs are `uuid`; all tables use `created_at` and `updated_at`.

## Tables + key fields

### studios

- id (uuid, pk)
- name (text)
- created_at (timestamp)
- updated_at (timestamp)

### users

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- email (text)
- full_name (text, nullable)
- role (owner | manager | coach | frontdesk)
- is_active (bool)
- created_at (timestamp)
- updated_at (timestamp)

### members

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- first_name (text)
- last_name (text)
- email (text, nullable)
- phone (text, nullable)
- status (active | frozen | inactive)
- created_at (timestamp)
- updated_at (timestamp)

### coaches (simple MVP staff)

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- name (text)
- user_id (uuid, nullable, fk -> users.id)
- is_active (bool)
- created_at (timestamp)
- updated_at (timestamp)

### class_types

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- name (text)
- default_capacity (int, nullable)
- duration_minutes (int, nullable)
- is_active (bool)
- created_at (timestamp)
- updated_at (timestamp)

### plans

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- name (text)
- type (unlimited | limited)
- class_limit (int, nullable)
- billing_period (monthly | one_time)
- price_cents (int)
- is_active (bool)
- created_at (timestamp)
- updated_at (timestamp)

### contracts

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- member_id (uuid, fk -> members.id)
- plan_id (uuid, fk -> plans.id)
- status (active | paused | cancelled | expired)
- plan_type_snapshot (unlimited | limited)
- class_limit_snapshot (int, nullable)
- remaining_classes (int, nullable)
- start_date (date)
- end_date (date, nullable)
- paused_from (date, nullable)
- paused_until (date, nullable)
- created_at (timestamp)
- updated_at (timestamp)

### sessions

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- class_type_id (uuid, fk -> class_types.id)
- coach_id (uuid, nullable, fk -> coaches.id)
- starts_at (timestamp)
- ends_at (timestamp, nullable)
- capacity (int)
- status (scheduled | cancelled)
- created_at (timestamp)
- updated_at (timestamp)

### attendance

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- session_id (uuid, fk -> sessions.id)
- member_id (uuid, fk -> members.id)
- status (checked_in | cancelled | no_show)
- checked_in_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)

### payments (manual for MVP)

- id (uuid, pk)
- studio_id (uuid, fk -> studios.id)
- member_id (uuid, fk -> members.id)
- contract_id (uuid, nullable, fk -> contracts.id)
- amount_cents (int)
- currency (text)
- method (cash | card | bank_transfer | other)
- status (recorded | refunded | void)
- paid_at (timestamp)
- recorded_by_user_id (uuid, nullable, fk -> users.id)
- note (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)

## Relationship notes

- `studios` 1-N `users`, `members`, `coaches`, `class_types`, `plans`, `contracts`, `sessions`, `attendance`, `payments`.
- `members` 1-N `contracts`, `attendance`, `payments`.
- `plans` 1-N `contracts`.
- `class_types` 1-N `sessions`.
- `coaches` 1-N `sessions` (nullable `coach_id` supports "TBD coach").
- `sessions` 1-N `attendance`.
- `contracts` 1-N `payments` (payment can be linked to a specific contract or left null).
- Attendance check-in is idempotent per member/session via a unique key on `(studio_id, session_id, member_id)`.
- For limited plans, check-in decrements `contracts.remaining_classes`; for unlimited plans, `remaining_classes` stays null.
- Prefer tenant-safe foreign keys using `(studio_id, foreign_id) -> parent(studio_id, id)` to prevent cross-studio links.

## Required indexes and uniques

### Required uniques

- `users`: unique(`studio_id`, `email`)
- `coaches`: unique(`studio_id`, `user_id`)
- `class_types`: unique(`studio_id`, `name`)
- `plans`: unique(`studio_id`, `name`)
- `attendance`: unique(`studio_id`, `session_id`, `member_id`)
- `members`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `plans`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `class_types`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `coaches`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `sessions`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `contracts`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)
- `users`: unique(`studio_id`, `id`) (for tenant-safe composite FK support)

### Required indexes

- `members`: index(`studio_id`, `status`)
- `contracts`: index(`studio_id`, `member_id`, `status`)
- `contracts`: index(`studio_id`, `start_date`)
- `sessions`: index(`studio_id`, `starts_at`)
- `sessions`: index(`studio_id`, `coach_id`, `starts_at`)
- `sessions`: index(`studio_id`, `class_type_id`, `starts_at`)
- `attendance`: index(`studio_id`, `session_id`, `status`)
- `attendance`: index(`studio_id`, `member_id`, `created_at`)
- `payments`: index(`studio_id`, `paid_at`)
- `payments`: index(`studio_id`, `member_id`, `paid_at`)
- `payments`: index(`studio_id`, `contract_id`)

## Required data checks (MVP)

- `plans`: if `type = limited`, then `class_limit > 0`; if `type = unlimited`, then `class_limit IS NULL`.
- `contracts`: `remaining_classes >= 0` when present.
- `contracts`: if `plan_type_snapshot = unlimited`, then `remaining_classes IS NULL`.
- `contracts`: if `plan_type_snapshot = limited`, then `class_limit_snapshot > 0`.
- `sessions`: `capacity > 0`.
- `payments`: `amount_cents > 0`.

## Why these changes

- Rebuilt the truncated `payments` section so MVP payment tracking is complete.
- Added `updated_at` to all tables to support safe edits and auditing.
- Added `members.email` to support reliable member lookup and communication.
- Added `plan_type_snapshot` and `class_limit_snapshot` to keep contract history stable even if plan definitions change later.
- Added `ends_at` on sessions so calendar views and overlap checks are possible.
- Added optional `contract_id` on payments so both contract-bound and standalone manual payments are supported.
- Added `recorded_by_user_id` on payments for basic accountability in manual cash-desk flows.
- Added tenant-safe FK guidance using `(studio_id, id)` pairs to prevent cross-tenant data links at the DB layer.
- Added required unique/index lists so check-in, scheduling, and payment queries stay fast under tenant filtering.
- Added explicit rule checks for limited/unlimited and positive amounts/capacity to prevent invalid business state.
