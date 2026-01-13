# Implementation Plan: Complete Profile E2E Tests Simplification

## Overview

Simplifier le fichier `complete-profile.spec.ts` de 519 lignes avec 9 tests instables vers ~80 lignes avec 2 tests stables et robustes. Cette simplification est justifiée par le fait que les 7 tests supprimés sont redondants avec les 22 tests unitaires existants dans `complete-profile-store.spec.ts`.

**Approche** : Garder uniquement les tests qui valident le comportement de navigation (non testable en unitaire), supprimer les tests de logique métier pure (déjà couverts en unitaire).

## Dependencies

Aucune dépendance externe. Les utilitaires existants (`setupAuthBypass`, `TEST_CONFIG`) sont suffisants.

## File Changes

### `frontend/e2e/tests/features/complete-profile.spec.ts`

**Action principale** : Réécrire complètement le fichier en supprimant toute la complexité.

#### 1. Supprimer les helper functions inutilisés

- Supprimer `setupFirstTimeUserRoutes` (lignes 10-156) - 147 lignes de complexité excessive
- Supprimer `setupReturningUserRoutes` (lignes 162-226) - peut être simplifié inline
- Raison : Ces helpers gèrent trop de routes (OAuth, templates, settings) pour des tests qui n'en ont pas besoin

#### 2. Restructurer le fichier selon les patterns du projet

- Utiliser `test as base` de `@playwright/test` (pattern actuel correct)
- Conserver `test.describe.configure({ mode: 'parallel' })` (pattern du projet)
- Suivre le pattern de `authentication.spec.ts` et `navigation.spec.ts` pour la structure

#### 3. Test 1 : Redirect returning user

**Comportement testé** : Un utilisateur avec budget existant est redirigé vers `/app/current-month`

- Setup : Route `**/api/v1/budgets**` retournant un budget existant (inline, ~15 lignes)
- Setup : `setupAuthBypass(page, { includeApiMocks: false, setLocalStorage: true })`
- Action : `page.goto('/app/complete-profile')`
- Assertion : `await expect(page).toHaveURL(/\/app\/current-month/)`
- Pattern : Suivre Playwright best practices avec web-first assertions

#### 4. Test 2 : Display form for first-time user

**Comportement testé** : Un utilisateur sans budget voit le formulaire complete-profile

- Setup : Route `**/api/v1/budgets**` retournant `{ success: true, data: [] }`
- Setup : Route `**/api/v1/users/settings**` (nécessaire pour éviter erreurs)
- Setup : `setupAuthBypass(page, { includeApiMocks: false, setLocalStorage: true })`
- Action : `page.goto('/app/complete-profile')`
- Assertions DOM :
  - `await expect(page).toHaveURL(/\/app\/complete-profile/)`
  - `await expect(page.getByTestId('first-name-input')).toBeVisible()`
  - `await expect(page.getByTestId('monthly-income-input')).toBeVisible()`
- Consider : Ne PAS tester l'état du bouton (disabled/enabled) - c'est de la logique métier testée en unitaire

#### 5. Supprimer les 7 tests redondants

| Test à supprimer | Raison |
|------------------|--------|
| `should prefill firstName from OAuth metadata (givenName)` | Redondant avec test unitaire `prefillFromOAuthMetadata` ligne 168-181 |
| `should prefill firstName from OAuth fullName when givenName missing` | Redondant avec test unitaire ligne 183-195 |
| `should enable next button when step 1 is valid` | Redondant avec test unitaire `isStep1Valid` ligne 269-274 |
| `should navigate to step 2 and show optional charges` | Teste le composant Material Stepper (déjà testé par la lib) |
| `should create minimal budget (skip step 2 charges)` | Redondant avec test unitaire `submitProfile` ligne 285-305 |
| `should create budget with pay day setting` | Redondant avec test unitaire ligne 322-340 |
| `should create full budget with all charges filled` | Redondant avec test unitaire ligne 426-447 |

#### 6. Structure finale attendue

```
// ~80 lignes au lieu de 519
import { test as base, expect } from '@playwright/test';
import { setupAuthBypass } from '../../utils/auth-bypass';
import { TEST_CONFIG } from '../../config/test-config';

base.describe('Complete Profile Flow', () => {
  base.describe.configure({ mode: 'parallel' });

  base('should redirect returning user with existing budget to dashboard', ...)
  base('should display complete profile form for first-time user', ...)
});
```

## Testing Strategy

### Tests conservés

1. **Redirect test** : Valide le comportement de navigation avec `hasBudgetGuard`
2. **Display form test** : Valide le rendu DOM complet de la page

### Validation post-implémentation

- Exécuter : `cd frontend && pnpm test:e2e -- tests/features/complete-profile.spec.ts`
- Vérifier : Les 2 tests passent de manière stable
- Vérifier : Pas de flakiness sur 3 exécutions consécutives

### Coverage totale maintenue

| Fonctionnalité | Tests Unitaires | Tests E2E |
|----------------|-----------------|-----------|
| `checkExistingBudgets()` | 3 tests | 2 tests (flow complet) |
| `prefillFromOAuthMetadata()` | 5 tests | - |
| `isStep1Valid()` | 4 tests | - |
| `submitProfile()` | 10 tests | - |
| Navigation/redirect | - | 2 tests |
| **Total** | **22 tests** | **2 tests** |

## Documentation

Aucune mise à jour de documentation nécessaire.

## Rollout Considerations

- **Aucun breaking change** : Les tests E2E sont internes
- **Aucune migration** : Remplacement direct du fichier
- **Bénéfice immédiat** : Réduction de 85% du code, tests plus stables

## Bonnes Pratiques Playwright Appliquées

1. **Web-first assertions** : Utiliser `await expect(locator).toBeVisible()` plutôt que `expect(await locator.isVisible()).toBe(true)`
2. **Locators robustes** : Préférer `getByTestId` pour les éléments de formulaire
3. **Minimal setup** : Mocker uniquement les routes nécessaires au test
4. **Parallel execution** : Maintenir `mode: 'parallel'` pour la performance
5. **Focus comportement** : Tester ce que l'utilisateur voit, pas l'implémentation interne
