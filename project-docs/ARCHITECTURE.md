# ARCHITECTURE

## Stack (MVP)
- Next.js (fullstack)
- Postgres
- Prisma
- Auth (Supabase Auth or Clerk)
- Deploy: Vercel (web) + managed Postgres

## Core rules
- Multi-tenant: studio_id in almost every table.
- No microservices for MVP.
- Migrations only via Prisma.
- Keep domain modules separated.

## Domains (modules)
- studios
- users/roles
- members
- plans
- contracts
- sessions
- attendance
- payments
