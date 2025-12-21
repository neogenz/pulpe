# Implementation: Fix Tutorial Tours from Help Menu

## Completed

### 1. Timing fix (tutorial.service.ts)
- Ajout de `Injector` via `inject()`
- Import de `afterNextRender` (zoneless-compatible)
- Nouvelle méthode `#waitForNextRender()` utilisant `afterNextRender`
- Appel après navigation dans `#prepareAndExecuteTour()`

### 2. Tours retirés du menu d'aide (main-layout.ts)
- **add-transaction** : Retiré car nécessite le bottom sheet ouvert (impossible depuis menu)
- **budget-management** : Retiré car nécessite d'être sur une page budget spécifique (URL dynamique)

Ces tours restent fonctionnels via auto-start sur leurs pages respectives.

### 3. Tours restants dans le menu d'aide
| Tour | Target Route | État |
|------|--------------|------|
| dashboard-welcome | current-month | ✓ Fonctionnel |
| budget-calendar | budget | ✓ Fonctionnel |
| templates-intro | budget-templates | ✓ Fonctionnel |

## Cause racine identifiée

1. **Problème de timing** : Après suppression du delay arbitraire, aucune attente n'était faite → `afterNextRender` ajouté
2. **Problèmes de design** :
   - `add-transaction` : Premier step attend un élément dans un bottom sheet jamais ouvert
   - `budget-management` : Pas de `targetRoute`, attend des éléments sur page budget details

## Test Results

- **Lint**: ✓ All files pass
- **Tests**: ✓ 650/650 passed
  - tutorial.service.spec.ts: 22 tests
  - main-layout.spec.ts: 28 tests

## Files Modified

- `projects/webapp/src/app/core/tutorial/tutorial.service.ts`
- `projects/webapp/src/app/layout/main-layout.ts`

## Follow-up

**Validation manuelle recommandée** : Tester les 3 tours restants depuis le menu aide.
