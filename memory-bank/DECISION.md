# Pulpe - Architecture Decision Records (ADR)

## DR-001: Backend-First Demo Mode

**Context**: Needed demo mode for product exploration without signup

**Decision**: Create real ephemeral Supabase users with JWT tokens
- Users marked with `is_demo: true` metadata
- Full backend functionality (RLS, validation, rollover calculation)
- Auto-cleanup via cron job (24h retention)

**Rationale**:
- Guarantees identical behavior to production (no frontend-only simulation drift)
- Reuses existing RLS policies and business logic
- Simplifies frontend (same code paths for demo/real users)

**Rejected Alternative**: Frontend-only localStorage mock
- Would require maintaining parallel state management
- Risk of divergence from real backend behavior
- Complex transaction/rollover simulation

---

## DR-002: Automated Demo Cleanup Strategy

**Context**: Need to prevent database bloat from abandoned demo users

**Decision**: Automated cron job cleanup
- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Retention: 24 hours from user creation
- Manual endpoint: Dev-only for testing/emergency cleanup

**Rationale**:
- 24h retention: Sufficient exploration time without excessive DB usage
- 6h interval: Balances cleanup frequency vs DB load
- Supabase cascade delete: Automatic cleanup of budgets/transactions/templates

**Alternative**: Manual cleanup only
- Risk of forgotten cleanup leading to DB bloat
- Requires operational overhead

---

## DR-003: Remove Variable Transaction Recurrence

**Context**: Initial design included `monthly`/`one_off` recurrence for transactions

**Decision**: Remove recurrence entirely from transactions
- Budget lines: Keep frequency (`fixed`/`one_off`) for planning
- Transactions: Always one-off manual entries

**Rationale**:
- Aligns with "Planning > Tracking" philosophy (budget lines = plan, transactions = reality)
- Simplifies transaction model (YAGNI principle)
- Reduces frontend/backend complexity
- Recurring patterns belong in templates/budget lines, not transactions

**Impact**:
- Removed `recurrence` column from transaction table
- Simplified transaction forms and validation
- Cleaner separation between planning (budget lines) and tracking (transactions)

---

## DR-004: Typed & Versioned Storage Service

**Context**: Bug de fuite de données entre utilisateurs (données localStorage persistantes après logout). Fix initial par nettoyage des clés `pulpe-*` mais approche fragile.

**Decision**: Implémenter un service de storage typé avec versioning et migrations
- Registre centralisé des clés de storage avec typage fort
- Validation Zod à la lecture des données
- Versioning par clé avec format `{ version, data, updatedAt }`
- Système de migrations automatiques au démarrage
- Distinction `user-scoped` vs `app-scoped` pour le nettoyage

**Rationale**:
- Type-safety: Erreurs de compilation si clé/valeur incorrecte
- Évolutivité: Migrations automatiques lors des changements de schéma
- Maintenabilité: Registre unique = source de vérité pour toutes les clés
- Debugging: Versioning permet de tracer l'état des données

**Rejected Alternative**: Nettoyage par convention de préfixe (`pulpe-*`)
- Pas de typage fort (runtime errors possibles)
- Pas de migration automatique (données corrompues/obsolètes)
- Risque d'oubli lors de l'ajout de nouvelles clés

**Status**: À implémenter
