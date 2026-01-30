# Pulpe - Technical Context & Decision Records

> Technical decisions and stack details following MADR (Markdown Any Decision Records) 2026 standard.

---

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend | NestJS 11+, Bun runtime |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | TypeScript strict, Zod schemas |
| Orchestration | pnpm workspaces + Turborepo |

---

## Active Decisions

| ID | Title | Date | Status |
|----|-------|------|--------|
| DR-001 | Backend-First Demo Mode | 2024-06-15 | Accepted |
| DR-002 | Automated Demo Cleanup | 2024-06-15 | Accepted |
| DR-003 | Remove Variable Transaction Recurrence | 2024-07-20 | Accepted |
| DR-004 | Typed & Versioned Storage Service | 2024-11-10 | Pending |
| DR-005 | Cache-First Data Loading in Dashboard | 2026-01-30 | Accepted |

---

## DR-005: Cache-First Data Loading in Dashboard

**Date**: 2026-01-30
**Status**: Accepted

### Context

Le dashboard rechargait `GET /budgets` à chaque navigation (retour depuis Budgets, Modèles, etc.) malgré un système de cache (`BudgetCache`) et un preloader (`AppPreloader`) déjà en place.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data loader vérifie le cache avant l'API | Cache-first lookup dans `createDashboardDataLoader` | Même pattern que `BudgetListStore` et `BudgetDetailsStore` |
| `getBudgetForMonth$` reste inchangé | Fallback API conservé | Évite les régressions sur les autres consommateurs |
| Race condition initiale acceptée | Pas de restructuration de l'init | Ne se produit qu'une fois au login/reload |

### Problem

`current-month-data-loader.ts` appelait `budgetApi.getBudgetForMonth$()` qui exécute systématiquement `getAllBudgets$()` (HTTP GET brut), ignorant le cache `BudgetCache.budgets()` rempli par le preloader. Chaque retour au dashboard déclenchait un appel réseau inutile.

### Decision

Le data loader consulte d'abord `budgetCache.budgets()` pour trouver le budget du mois courant. Si le cache contient les données, aucun appel HTTP. Le fallback API reste en place pour les cache miss.

### Rationale

- Le pattern cache-first existait déjà dans `BudgetListStore` (ligne 179) et `BudgetDetailsStore` (ligne 148) — seul le dashboard ne l'appliquait pas
- Le preloader remplit le cache au login, donc les navigations suivantes sont instantanées
- Changement minimal (1 fichier) avec impact maximal sur la réactivité perçue

### Consequences

- **Positive**: 0 requêtes réseau lors des navigations inter-écrans après le chargement initial
- **Trade-off**: Doublon `GET /budgets` au premier chargement (race preloader/store) — accepté
- **Impact**: `current-month-data-loader.ts` uniquement

---

## DR-001: Backend-First Demo Mode

**Date**: 2024-06-15
**Status**: Accepted

### Problem

Needed demo mode for product exploration without signup.

### Decision Drivers

- Must behave identically to production
- Cannot maintain parallel frontend-only simulation
- Must reuse existing RLS policies

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Real ephemeral users | Create Supabase users with `is_demo: true` | Chosen |
| B: Frontend localStorage mock | Simulate state in browser | Rejected |

### Decision

Create real ephemeral Supabase users with JWT tokens.

### Rationale

- Guarantees identical behavior to production (no simulation drift)
- Reuses existing RLS policies and business logic
- Simplifies frontend (same code paths for demo/real users)

### Consequences

- **Positive**: No simulation drift, full backend validation
- **Trade-off**: Requires cleanup cron job (see DR-002)
- **Dependencies**: Supabase Auth, RLS policies

### Notes

Stack-specific: Supabase cascade delete handles cleanup of related tables automatically.

---

## DR-002: Automated Demo Cleanup Strategy

**Date**: 2024-06-15
**Status**: Accepted

### Problem

Need to prevent database bloat from abandoned demo users.

### Decision Drivers

- Must run automatically without manual intervention
- Should balance cleanup frequency vs DB load
- Must not affect active demo sessions

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Automated cron job | Every 6 hours, 24h retention | Chosen |
| B: Manual cleanup only | Admin triggers manually | Rejected |

### Decision

Automated cron job cleanup with:
- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Retention: 24 hours from user creation
- Manual endpoint: Dev-only for testing/emergency cleanup

### Rationale

- 24h retention: Sufficient exploration time without excessive DB usage
- 6h interval: Balances cleanup frequency vs DB load
- Supabase cascade delete: Automatic cleanup of budgets/transactions/templates

### Consequences

- **Positive**: Zero maintenance overhead
- **Trade-off**: Users lose demo data after 24h (acceptable for demo)
- **Dependencies**: Supabase scheduled functions, cascade delete

### Notes

Consider adding warning toast at 23h mark if user session is still active.

---

## DR-003: Remove Variable Transaction Recurrence

**Date**: 2024-07-20
**Status**: Accepted

### Problem

Initial design included `monthly`/`one_off` recurrence for transactions, adding unnecessary complexity.

### Decision Drivers

- Aligns with "Planning > Tracking" philosophy
- Reduces frontend/backend complexity
- YAGNI principle

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Remove recurrence | Transactions always one-off | Chosen |
| B: Keep recurrence | Support recurring transactions | Rejected |

### Decision

Remove recurrence entirely from transactions:
- Budget lines: Keep frequency (`fixed`/`one_off`) for planning
- Transactions: Always one-off manual entries

### Rationale

- Budget lines = plan, transactions = reality
- Recurring patterns belong in templates/budget lines, not transactions
- Simplifies transaction model significantly

### Consequences

- **Positive**: Cleaner separation between planning and tracking
- **Trade-off**: No automated recurring transaction support
- **Impact**: Removed `recurrence` column from transaction table

### Notes

If users request recurring transactions in future, implement as "auto-generated budget lines" rather than transaction recurrence.

---

## DR-004: Typed & Versioned Storage Service

**Date**: 2024-11-10
**Status**: Pending

### Problem

Bug de fuite de données entre utilisateurs (données localStorage persistantes après logout). Fix initial par nettoyage des clés `pulpe-*` mais approche fragile.

### Decision Drivers

- Type-safety required for compile-time errors
- Need automatic migrations when schema changes
- Must distinguish user-scoped vs app-scoped data

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Typed storage service | Centralized registry with versioning | Chosen |
| B: Prefix convention | Clean `pulpe-*` keys on logout | Rejected |

### Decision

Implement a typed storage service with:
- Centralized registry with strong typing
- Zod validation on read
- Versioning per key: `{ version, data, updatedAt }`
- Automatic migrations at startup
- `user-scoped` vs `app-scoped` distinction

### Rationale

- Type-safety: Compile-time errors for wrong key/value
- Evolvability: Automatic migrations on schema changes
- Maintainability: Single source of truth for all keys
- Debugging: Versioning enables state tracing

### Consequences

- **Positive**: Eliminates class of storage bugs
- **Trade-off**: Initial implementation overhead
- **Dependencies**: Zod schemas

### Notes

Implementation pending. Priority: Medium (bug was hotfixed, this is preventive).

---

*See `systemPatterns.md` for architecture patterns.*
*See `INFRASTRUCTURE.md` for deployment and CI/CD.*
