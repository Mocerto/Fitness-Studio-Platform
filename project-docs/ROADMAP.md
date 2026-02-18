# ROADMAP (MVP)

## Phase 0 — Foundation
- Repo + Next.js app runs
- Auth enabled (roles)
- Postgres connected + Prisma migrations working

## Phase 1 — ERP Core (must work)
- Members CRUD (status: active/frozen/inactive)
- Plans CRUD (unlimited / limited with class_limit)
- Contracts (member has a plan; remaining_classes for limited)
- Sessions schedule (date/time, coach, capacity)
- Attendance check-in flow (validates contract, capacity, decrements remaining_classes if needed)
- Payments (manual entries at first)

## Phase 2 — Basic analytics
- Today attendance
- Weekly revenue
- Churn hints (optional later)

## Phase 3 — Member Portal (later)
- Member view of contract + attendance history
- Booking (optional)
