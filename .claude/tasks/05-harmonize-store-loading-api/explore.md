# Task: Harmonize Store Loading/Error API

## Executive Summary

10 stores trouvés dans le codebase avec **3 patterns distincts** pour exposer les états loading/error. L'inconsistance complique l'utilisation (ex: le code tutorial qui doit checker différentes APIs selon le store).

---

## Patterns Identifiés

### Pattern 1: Angular resource() avec isLoading() et error()

**Stores concernés :** 2

| Store | Fichier | API Loading | API Error |
|-------|---------|-------------|-----------|
| TemplateDetailsStore | `template-details-store.ts:42-47` | `isLoading = computed(() => resource.isLoading())` | `error = computed(() => resource.error())` |
| BudgetDetailsStore | `budget-details-store.ts:63-67` | `isLoading = computed()` + `hasError = computed()` | `error = computed()` |

**Note :** BudgetDetailsStore est le seul à exposer `hasError()` boolean en plus de `error()`.

### Pattern 2: Angular resource() avec status()

**Stores concernés :** 3

| Store | Fichier | API Loading | API Error |
|-------|---------|-------------|-----------|
| BudgetListStore | `budget-list-store.ts:26-29` | `budgets.status()` direct | Via status === 'error' |
| CurrentMonthStore | `current-month-store.ts:109` | `dashboardStatus = computed(() => resource.status())` | Via status === 'error' |
| BudgetTemplatesState | `budget-templates-state.ts:17-27` | `budgetTemplates.status()` (rxResource) | RxJS catchError |

**Avantage :** Plus granulaire (`'idle' | 'loading' | 'reloading' | 'resolved' | 'error' | 'local'`)

### Pattern 3: Manual signal-based state

**Stores concernés :** 4

| Store | Fichier | API Loading | API Error |
|-------|---------|-------------|-----------|
| TemplateLineStore | `template-line-store.ts:28-29` | `isLoading = signal(false)` direct | `error = signal()` direct |
| TemplateStore | `template-store.ts:55-58` | `isLoadingTemplates = computed()` | `error = computed()` |
| OnboardingStore | `onboarding-store.ts:77-78` | `isSubmitting = computed()` | `error = computed()` |
| AuthApi | `auth-api.ts:32-42` | `isLoading = signal().asReadonly()` | Pas d'error signal |

---

## Fichiers Clés

| Fichier | Lignes | Pattern | Notes |
|---------|--------|---------|-------|
| `feature/budget-templates/details/services/template-details-store.ts` | 42-47 | resource + isLoading() | Propre |
| `feature/budget/budget-details/store/budget-details-store.ts` | 63-67 | resource + isLoading() + hasError() | Unique hasError() |
| `feature/budget/budget-list/budget-list-store.ts` | 26-29, 154 | resource + status() | Inline status check |
| `feature/current-month/services/current-month-store.ts` | 109, 165 | resource + dashboardStatus() | Computed wrapper |
| `feature/budget-templates/services/budget-templates-state.ts` | 17-27, 42 | rxResource + status() | RxJS integration |
| `feature/budget-templates/details/services/template-line-store.ts` | 28-29 | Manual signals directs | Anti-pattern vs conventions |
| `feature/budget/budget-list/create-budget/services/template-store.ts` | 55-58 | Manual + computed | Suit STATE-PATTERN.md |
| `feature/onboarding/onboarding-store.ts` | 77-78 | Manual + computed | isSubmitting (sémantique) |
| `core/auth/auth-api.ts` | 32-42 | Manual + asReadonly() | Core service pattern |

---

## Problèmes Identifiés

### 1. API incohérente pour vérifier si "data loaded"

```typescript
// Pattern 1 - Boolean
!store.isLoading() && !store.hasError()

// Pattern 2 - Status check
store.status() === 'resolved' || store.status() === 'local'

// Pattern 3 - Signal direct
!store.isLoading()
```

### 2. TemplateLineStore expose des signals publics mutables

```typescript
// ❌ Anti-pattern (template-line-store.ts:28-29)
readonly isLoading = signal(false);  // Mutable depuis l'extérieur!
readonly error = signal<string | null>(null);

// ✅ Pattern recommandé (STATE-PATTERN.md)
readonly #state = signal<State>({...});
readonly isLoading = computed(() => this.#state().isLoading);
```

### 3. Nommage variable

- `isLoading` vs `isLoadingTemplates` vs `isSubmitting`
- `dashboardStatus` vs accès direct à `.status()`

---

## Recommandations

### Option A: Standardiser sur isLoading() + hasError() + error()

Tous les stores exposent :
- `isLoading: Signal<boolean>` - true pendant le chargement
- `hasError: Signal<boolean>` - true si erreur
- `error: Signal<Error | null>` - l'erreur ou null
- `isReady: Signal<boolean>` - computed: `!isLoading && !hasError`

**Avantage :** API simple et uniforme
**Inconvénient :** Perd la granularité du status()

### Option B: Standardiser sur status() + error()

Tous les stores exposent :
- `status: Signal<ResourceStatus>` - état complet
- `error: Signal<Error | null>` - l'erreur
- `isReady: Signal<boolean>` - computed: `status === 'resolved' || status === 'local'`

**Avantage :** Plus d'information, aligné avec resource() Angular
**Inconvénient :** Plus verbeux à checker

### Option C: Interface commune IAsyncState

```typescript
interface IAsyncState {
  readonly isLoading: Signal<boolean>;
  readonly isReady: Signal<boolean>;  // ← Nouveau: true quand données prêtes
  readonly hasError: Signal<boolean>;
  readonly error: Signal<Error | null>;
}
```

Chaque store implémente cette interface, peu importe l'implémentation interne.

---

## Patterns à Suivre

De `STATE-PATTERN.md` :
- Private state signal + public computed selectors
- Immutable state updates
- Single source of truth

De `signals.md` :
- `signal().asReadonly()` pour exposer des signals privés
- `computed()` pour les valeurs dérivées

---

## Dépendances

- Aucune dépendance externe
- Changements uniquement internes aux stores
- Tests existants à mettre à jour si API change

---

## Estimation d'impact

| Fichiers à modifier | Stores | Tests |
|---------------------|--------|-------|
| 8 stores | 8 | ~15 fichiers spec |
| 4 composants (tutorial usage) | - | - |

---

## Prochaine étape

Choisir une option (A, B, ou C) puis créer le plan d'implémentation avec `/epct:plan 05-harmonize-store-loading-api`.
