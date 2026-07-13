# Database

## Setup
- Supabase PostgreSQL with typed `supabase-js` repositories and no ORM. Current contract: `backend-nest/src/types/database.types.ts`; migrations: `backend-nest/supabase/migrations/`.

## Main entities
```mermaid
---
title: Pulpe macro data model
---
erDiagram
    AUTH_USER ||--o{ TEMPLATE : owns
    AUTH_USER ||--o| USER_ENCRYPTION_KEY : secures
    TEMPLATE ||--o{ TEMPLATE_LINE : contains
    TEMPLATE ||--o{ MONTHLY_BUDGET : generates
    MONTHLY_BUDGET ||--o{ BUDGET_LINE : plans
    MONTHLY_BUDGET ||--o{ TRANSACTION : records
    BUDGET_LINE o|--o{ TRANSACTION : allocates
    SAVINGS_GOAL o|--o{ BUDGET_LINE : targets
```

## Conventions
- RLS enforces ownership; multi-row invariants use PostgreSQL RPCs. After schema changes run `bun run generate-types:local` in `backend-nest/`.
- Financial amounts are AES-256-GCM ciphertext in `text`; repositories must cross `ENCRYPTION_PORT`. See `docs/ENCRYPTION.md`.
