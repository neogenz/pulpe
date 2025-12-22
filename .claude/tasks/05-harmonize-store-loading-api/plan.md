# Implementation Plan: Harmonize Store Loading/Error API

## Overview

Standardiser l'API loading/error de tous les stores sur l'API native Angular `resource()`:
- `isLoading: Signal<boolean>` - true pendant le chargement
- `hasValue: Signal<boolean>` - TYPE GUARD (true si données disponibles)
- `error: Signal<Error | null>` - erreur ou null

Cette approche est **idiomatique Angular** car elle reprend exactement les signaux exposés par `resource()`.

## Dependencies

Ordre d'implémentation basé sur les dépendances:
1. **Stores sans dépendances** (peuvent être faits en parallèle)
2. **Composants** (après les stores dont ils dépendent)

## File Changes

### Phase 1: Stores avec resource() (modifications mineures)

#### `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.ts`

- **Action**: Ajouter `hasValue` computed
- **Ajouter**: `readonly hasValue = computed(() => this.#templateDetailsResource.hasValue());`
- **Position**: Après `isLoading` (L42-44)
- **Impact**: Aucun breaking change, ajout uniquement

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`

- **Action**: Renommer `hasError` → `hasValue` et inverser la logique
- **Modifier L64**: `readonly hasValue = computed(() => this.#budgetDetailsResource.hasValue());`
- **Supprimer**: L'ancien `hasError`
- **Impact**: Breaking change - rechercher usages de `hasError`

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts`

- **Action**: Ajouter les 3 computed signals
- **Ajouter après L29**:
  ```
  readonly isLoading = computed(() => this.budgets.isLoading());
  readonly hasValue = computed(() => this.budgets.hasValue());
  readonly error = computed(() => this.budgets.error());
  ```
- **Modifier L154**: Remplacer `this.budgets.status() !== 'loading'` par `!this.isLoading()`
- **Impact**: Aucun breaking change, ajout uniquement

#### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

- **Action**: Remplacer `dashboardStatus` par les 3 signals standards
- **Modifier L109**: Remplacer par:
  ```
  readonly isLoading = computed(() => this.#dashboardResource.isLoading());
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  readonly error = computed(() => this.#dashboardResource.error());
  ```
- **Supprimer**: `dashboardStatus`
- **Modifier L165**: Remplacer `this.dashboardStatus() !== 'loading'` par `!this.isLoading()`
- **Impact**: Breaking change - rechercher usages de `dashboardStatus`

### Phase 2: Stores manuels (refactoring plus important)

#### `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-line-store.ts`

- **Action**: Refactoring complet - rendre signals privés avec computed publics
- **Modifier L28-29**:
  - Renommer `isLoading` → `#isLoading` (private)
  - Renommer `error` → `#error` (private)
- **Ajouter après L29**:
  ```
  readonly isLoading = computed(() => this.#isLoading());
  readonly hasValue = computed(() => this.lines().length > 0 && !this.#error());
  readonly error = computed(() => this.#error());
  ```
- **Modifier usages internes**:
  - L152-154: `this.#isLoading.set(true)`, `this.#error.set(null)`
  - L180: `this.#error.set(errorMessage)`
  - L183: `this.#isLoading.set(false)`
  - L75: `this.#error.set(null)`
- **Impact**: Breaking change si des composants modifiaient directement les signals

#### `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts`

- **Action**: Renommer `isSubmitting` → `isLoading` pour cohérence
- **Vérifier**: Si `hasValue` et `error` existent, sinon ajouter
- **Pattern**: Utiliser computed depuis state privé
- **Impact**: Breaking change - rechercher usages de `isSubmitting`

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/services/template-store.ts`

- **Action**: Renommer `isLoadingTemplates` → `isLoading` pour cohérence
- **Ajouter**: `hasValue` si manquant
- **Impact**: Breaking change - rechercher usages de `isLoadingTemplates`

#### `frontend/projects/webapp/src/app/core/auth/auth-api.ts`

- **Action**: Ajouter `hasValue` et `error` signals
- **Ajouter**:
  ```
  readonly hasValue = computed(() => !!this.#user());
  readonly error = computed(() => this.#state().error);
  ```
- **Impact**: Aucun breaking change, ajout uniquement

### Phase 3: Mise à jour des composants consommateurs

#### Recherche des usages à mettre à jour

```bash
# Rechercher usages de hasError
grep -r "hasError" frontend/projects/webapp/src/

# Rechercher usages de dashboardStatus
grep -r "dashboardStatus" frontend/projects/webapp/src/

# Rechercher usages de isSubmitting
grep -r "isSubmitting" frontend/projects/webapp/src/

# Rechercher usages de isLoadingTemplates
grep -r "isLoadingTemplates" frontend/projects/webapp/src/
```

Pour chaque composant trouvé:
- Remplacer `store.hasError()` → `!store.hasValue()`
- Remplacer `store.dashboardStatus()` → utiliser `isLoading`, `hasValue`, `error`
- Remplacer `store.isSubmitting()` → `store.isLoading()`
- Remplacer `store.isLoadingTemplates()` → `store.isLoading()`

### Phase 4: Tests

#### `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.spec.ts`

- **Ajouter**: Test pour `hasValue` signal
- **Vérifier**: `hasValue` retourne false initialement, true après chargement

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`

- **Modifier**: Tests qui utilisent `hasError` → `hasValue`
- **Inverser**: Les assertions (true ↔ false)

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.spec.ts`

- **Ajouter**: Tests pour `isLoading`, `hasValue`, `error`

#### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.spec.ts`

- **Modifier**: Tests qui utilisent `dashboardStatus`
- **Remplacer**: Par tests sur `isLoading`, `hasValue`, `error`

#### `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-line-store.spec.ts`

- **Modifier**: Tests qui accèdent directement aux signals
- **Vérifier**: Qu'on ne peut plus modifier `isLoading`/`error` de l'extérieur

## Testing Strategy

### Approche

1. **Par store**: Modifier un store, exécuter ses tests, corriger
2. **Validation globale**: `pnpm quality` après chaque phase
3. **Tests E2E**: Exécuter après Phase 3

### Commandes

```bash
# Tests unitaires par store
cd frontend && pnpm test -- template-details-store.spec.ts
cd frontend && pnpm test -- budget-details-store.spec.ts
cd frontend && pnpm test -- budget-list-store.spec.ts
cd frontend && pnpm test -- current-month-store.spec.ts
cd frontend && pnpm test -- template-line-store.spec.ts

# Validation globale
pnpm quality

# E2E
pnpm test:e2e
```

## Documentation

Aucune documentation externe à mettre à jour. Le pattern est auto-documenté par l'alignement sur l'API Angular `resource()`.

## Rollout Considerations

- **Breaking changes**: `hasError` → `hasValue`, `dashboardStatus`, `isSubmitting`, `isLoadingTemplates`
- **Feature flag**: Non nécessaire - changement atomique
- **Rollback**: Git revert si problème
- **Migration**: Toutes les modifications dans un seul PR pour atomicité
