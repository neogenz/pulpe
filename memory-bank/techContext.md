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
| DR-005 | Temp ID Replacement Before Toggle Cascade | 2026-01-30 | Accepted |
| DR-006 | Split-Key Encryption for Financial Amounts | 2026-01-29 | Accepted |
| DR-007 | Zoneless Testing — Child Input Signal Limitation | 2026-02-13 | Accepted |
| DR-008 | Centralized ApiClient with Mandatory Zod Validation | 2026-02-13 | Accepted |
| DR-009 | Signal Store Pattern with SWR | 2026-02-13 | Accepted |

---

## DR-009: Signal Store Pattern with SWR

**Date**: 2026-02-13
**Status**: Accepted

### Problem

Les stores utilisaient des `Subject` + `concatMap` RxJS pour les mutations et affichaient un spinner plein écran à chaque refetch, même pour un refresh en arrière-plan.

### Decision Drivers

- Angular 21+ signals-first : RxJS mutation queues ajoutent de la complexité inutile
- UX : l'utilisateur préfère voir des données stales plutôt qu'un spinner à chaque navigation

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: RxJS mutation queue + spinner systématique | Conserver `Subject` + `concatMap` + `isLoading` global | Rejected — over-engineered |
| B: async/await mutations + SWR pattern | Mutations directes, `isInitialLoading` pour spinner initial uniquement | Chosen |

### Decision

Standardiser un store pattern en 6 sections (Dependencies, State, Resource, Selectors, Mutations, Private utils) avec :
- Mutations en async/await direct (plus de Subject queue)
- `isInitialLoading = computed(() => resource.status() === 'loading')` pour spinner initial uniquement
- Données stales visibles pendant le reloading

### Consequences

- **Positive** : Code plus simple, meilleure UX (pas de flash spinner)
- **Trade-off** : Pas de queueing intégré (pas nécessaire au volume actuel)
- **Impact** : `BudgetDetailsStore`, `CurrentMonthStore`, `BudgetTemplatesStore` refactorisés

---

## DR-008: Centralized ApiClient with Mandatory Zod Validation

**Date**: 2026-02-13
**Status**: Accepted

### Problem

Les services API injectaient `HttpClient` directement avec un error handling et une validation incohérents entre les features.

### Decision Drivers

- Pas de validation runtime des réponses API → bugs silencieux si le contrat backend change
- Error handling dupliqué dans chaque service
- Pas de normalisation des erreurs (format différent par service)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: HttpClient direct | Chaque service gère ses erreurs et parsing | Rejected — incohérent |
| B: ApiClient centralisé avec Zod | Un service unique avec validation obligatoire | Chosen |

### Decision

Tous les appels HTTP passent par `ApiClient` (`core/api/api-client.ts`) avec un schéma Zod obligatoire. Les feature APIs (`BudgetApi`, `TemplateApi`, etc.) retournent des `Observable<T>` validés.

### Consequences

- **Positive** : Validation runtime, error handling uniforme, meilleur debugging
- **Trade-off** : Chaque endpoint nécessite un schéma Zod
- **Impact** : 10+ services migrés (BudgetApi, TransactionApi, TemplateApi, EncryptionApi, UserSettingsApi, BudgetLineApi, BudgetTemplatesApi, ProfileSetupService, DemoInitializerService)

### Notes

- `ApplicationConfiguration` est la seule exception : elle charge `config.json` (asset statique) via `HttpClient` direct car `ApiClient` dépend d'elle pour `backendApiUrl` (dépendance circulaire).

---

## DR-007: Zoneless Testing — Child Input Signal Limitation

**Date**: 2026-02-13
**Status**: Accepted

### Problem

Lors du durcissement des tests `reset-password.spec.ts` (remplacement des lectures de signaux privés par des assertions DOM), les assertions ciblant des composants enfants (`ErrorAlert`, `LoadingButton`) échouent systématiquement. En mode zoneless (`provideZonelessChangeDetection()`), les `input()` signal des composants enfants ne se mettent pas à jour via `fixture.detectChanges()`, même après plusieurs cycles.

### Decision Drivers

- `ErrorAlert` : `message = input<string | null>(null)` — le `@if (message())` reste faux après `detectChanges()`
- `LoadingButton` : `disabled = input(false)` — le `<button>` interne garde `disabled` à sa valeur initiale
- Comportement reproductible à 100% sur Vitest + Angular 21 + `provideZonelessChangeDetection()`

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Assertions DOM sur composants enfants | Lire `getErrorAlertText()` / `button.disabled` | Rejected — flake 100% |
| B: Assertions directes sur signaux parent | Garder `component['errorMessage']()` / `component['canSubmit']()` | Chosen |
| C: Material Harnesses | Utiliser les harnesses Angular Material | Deferred — overhead disproportionné pour ce lot |

### Decision

Conserver les lectures de signaux privés (`component['...']()`) pour les assertions qui traversent des composants enfants à `input()` signal. Limiter les assertions DOM aux éléments rendus directement dans le template du composant parent (`@if`/`@else` blocks, `data-testid` sur éléments natifs).

### Rationale

- Les assertions DOM parent fonctionnent (`[data-testid="reset-password-form"]`, `mat-spinner` présence/absence) car elles testent la visibilité conditionnelle dans le template parent
- Les assertions DOM enfant échouent car le binding `[message]="errorMessage()"` vers un `input()` signal enfant n'est pas propagé par `detectChanges()` en mode zoneless
- Le couplage signal privé est acceptable en test : il ne fuit pas dans le code de production et reste stable tant que l'API interne ne change pas

### Consequences

- **Positive** : Tests stables (57/57, 10/10 runs), pas de flakiness
- **Trade-off** : ~13 accès `component['...']` restants dans `reset-password.spec.ts` au lieu de ~8
- **Trade-off** : Dette de test documentée — révisable si Angular corrige le comportement zoneless en test

### Notes

- Limitation confirmée sur : `ErrorAlert` (`ui/error-alert`), `LoadingButton` (`ui/loading-button`)
- Pattern valide pour assertions DOM parent : `@if`/`@else` conditionals, présence/absence d'éléments natifs
- Pattern invalide pour assertions DOM enfant : `input()` signal bindings sur composants OnPush

## DR-005: Temp ID Replacement Before Toggle Cascade

**Date**: 2026-01-30
**Status**: Accepted

### Problem

Creating a transaction under a checked parent budget line triggered a 404 error. The store called `toggleCheck` on the parent **before** replacing the temp ID (`temp-xxx`) with the real server ID. The cascade (`calculateBudgetLineToggle`) then included temp IDs in `transactionsToToggle`, causing `POST /transactions/temp-xxx/check → 404`.

### Decision Drivers

- Optimistic updates generate temp IDs (`temp-${uuidv4()}`) for immediate UI feedback
- `calculateBudgetLineToggle` is a pure function that returns whatever IDs are in state
- API calls require real server-assigned UUIDs

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Reorder operations | Replace temp ID before triggering cascade | Chosen |
| B: Filter temp IDs in cascade | Skip `temp-*` IDs in `transactionsToToggle` | Rejected |

### Decision

In `createAllocatedTransaction()`, replace the temp ID with the server response **before** triggering the parent budget line's `toggleCheck` cascade.

### Rationale

- Option A fixes the root cause (ordering) without coupling the pure utility to ID format conventions
- Option B would leak implementation details (`temp-` prefix) into `calculateBudgetLineToggle`
- Pure functions should not know about temp ID conventions — the store controls operation ordering

### Consequences

- **Positive**: No temp IDs reach API calls; pure functions remain agnostic
- **Trade-off**: Sequential await (replace → then toggle) instead of parallel
- **Impact**: `budget-details-store.ts:519-530` reordered

### Notes

Pattern applies to any optimistic update followed by cascade: always resolve temp IDs before triggering dependent operations.

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

## DR-006: Split-Key Encryption for Financial Amounts

**Date**: 2026-01-29
**Status**: Accepted

### Problem

L'administrateur Supabase peut lire tous les montants financiers en clair (`NUMERIC(12,2)`) via le Dashboard ou un client SQL. Pulpe revendique la confidentialité des données financières — cette promesse doit être techniquement réelle avant tout lancement public.

### Decision Drivers

- L'admin (propriétaire du projet) ne doit pas pouvoir décrypter les données utilisateurs
- Le backend doit pouvoir effectuer les calculs (rollover, sommes, soldes)
- Le code crypto côté client doit rester minimal (3 plateformes : Angular, SwiftUI, Android)
- Les 3 utilisateurs existants en production ne doivent perdre aucune donnée

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Server-side only (master key) | Backend chiffre avec une clé env var | Rejected — admin peut décrypter |
| B: Client-side E2E | Tout le chiffrement dans le navigateur/app | Rejected — backend ne peut plus calculer |
| C: Split-key (client PBKDF2 + backend HKDF) | DEK dérivée de deux parts : clientKey (mot de passe) + masterKey (env var) | Chosen |

### Decision

Architecture split-key :
- **Client** : dérive un `clientKey` depuis le mot de passe via PBKDF2 (600k itérations, SHA-256) au login
- **Backend** : combine `clientKey` + `masterKey` via HKDF → DEK utilisée pour AES-256-GCM
- **DEK jamais stockée** : dérivée à chaque requête, jetée après traitement
- **Table `user_encryption_key`** : stocke uniquement `salt` et `kdf_iterations` par utilisateur
- **Changement de mot de passe** : re-chiffrement complet des données utilisateur (acceptable au volume actuel)
- **Migration** : stratégie dual-column (plaintext + encrypted) pour réversibilité

### Rationale

- masterKey seule insuffisante pour décrypter → admin ne peut pas lire les données at rest
- Backend voit les données en clair en mémoire pendant les requêtes → permet les calculs serveur
- PBKDF2 côté client = quelques lignes natives (Web Crypto API, CryptoKit, JCA) → pas de lib tierce
- Dual-column protège les 3 users existants pendant la migration progressive

### Consequences

- **Positive** : Claim marketing "même l'admin ne peut pas décrypter sans votre mot de passe" techniquement vrai
- **Trade-off** : Perte de mot de passe = perte d'accès aux données (pas de recovery possible)
- **Trade-off** : Changement de mot de passe re-chiffre toutes les données (négligeable au volume actuel)
- **Trade-off** : ~300-500ms de PBKDF2 au login côté client (une seule fois)
- **Dependencies** : Web Crypto API (Angular), CryptoKit (SwiftUI), JCA (Android)

### Notes

- Issue GitHub : [#274](https://github.com/neogenz/pulpe/issues/274)
- Tables impactées : `budget_line`, `transaction`, `template_line`, `savings_goal`, `monthly_budget`
- Le re-chiffrement row-by-row est acceptable pour le volume actuel ; à batcher si >1000 users

---

*See `systemPatterns.md` for architecture patterns.*
*See `INFRASTRUCTURE.md` for deployment and CI/CD.*
