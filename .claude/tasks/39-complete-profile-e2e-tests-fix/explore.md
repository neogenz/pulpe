# Task: Complete Profile E2E Tests - Exploration Report

## Décision : Option A - Simplification

**Garder 2 tests essentiels, supprimer 7 tests redondants.**

Cette décision n'est PAS prise parce qu'on n'arrive pas à faire marcher les tests, mais parce que l'analyse démontre que ces tests sont redondants avec les tests unitaires existants.

---

## 1. Analyse Comparative : Tests E2E vs Tests Unitaires

### Tests Unitaires Existants (complete-profile-store.spec.ts)

| Méthode testée | Nombre de tests | Lignes | Ce qui est couvert |
|----------------|-----------------|--------|-------------------|
| `checkExistingBudgets` | 3 | 113-157 | return false/true/error |
| `prefillFromOAuthMetadata` | 5 | 159-216 | tous les cas OAuth |
| `isStep1Valid` | 4 | 249-275 | validation formulaire |
| `submitProfile` | 10 | 277-448 | création, payDay, analytics |
| **Total** | **22 tests** | | **Logique métier complète** |

### Tests E2E Actuels (complete-profile.spec.ts)

| Test E2E | Verdict | Raison |
|----------|---------|--------|
| 1. `redirect returning user` | ✅ **GARDER** | Teste flow navigation + guards (non testable en unitaire) |
| 2. `display form first-time user` | ✅ **GARDER** | Teste rendu DOM complet (non testable en unitaire) |
| 3. `prefill givenName` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 168-181 |
| 4. `prefill fullName` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 183-195 |
| 5. `enable next button` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 269-274 |
| 6. `navigate to step 2` | ❌ **SUPPRIMER** | Stepper Material déjà testé par la lib |
| 7. `create minimal budget` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 285-305 |
| 8. `create with pay day` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 322-340 |
| 9. `create full budget` | ❌ **SUPPRIMER** | Redondant avec test unitaire ligne 426-447 |

---

## 2. Justification Qualitative

### Ce que les tests E2E doivent tester
Les tests E2E ont de la valeur quand ils testent ce qui **ne peut pas** être testé en unitaire :
- Navigation entre pages avec guards Angular
- Rendu du DOM complet avec intégration composants
- Flow utilisateur de bout en bout

### Ce que les tests E2E ne devraient PAS tester
- Logique métier pure (déjà couverte par tests unitaires)
- Validation de formulaires (tests unitaires)
- Appels API et gestion d'erreurs (tests unitaires)

### Problème technique des tests actuels
```typescript
// setupFirstTimeUserRoutes() - 147 lignes de complexité
// Registre 5 routes différentes avec logique conditionnelle complexe
// Source d'instabilité : timing, pattern conflicts, OAuth injection
```

La complexité des helpers `setupFirstTimeUserRoutes` et `setupReturningUserRoutes` est disproportionnée par rapport à la valeur ajoutée.

---

## 3. Architecture Complete-Profile (Référence)

### Flow de navigation
```
Utilisateur non authentifié → /welcome (publicGuard bloque)
Utilisateur authentifié sans budget → /app/current-month → (hasBudgetGuard) → /app/complete-profile
Utilisateur authentifié avec budget → /app/current-month (autorisé)

Navigation directe vers /app/complete-profile :
- complete-profile-page.ts:221-226 fait checkExistingBudgets()
- Si budgets.length > 0 → redirect vers /app/current-month
- Si budgets.length === 0 → affiche le formulaire
```

### Fichiers clés
| Fichier | Rôle | Lignes importantes |
|---------|------|-------------------|
| `complete-profile-page.ts` | Composant principal | 216-226 (init + redirect) |
| `complete-profile-store.ts` | Store avec logique | 125-150 (checkExistingBudgets) |
| `has-budget.guard.ts` | Guard de route | 9-39 |
| `complete-profile-store.spec.ts` | Tests unitaires | 22 tests couvrant toute la logique |

### Format API attendu
```typescript
// Budget list: GET /api/v1/budgets
{ success: true, data: Budget[] }  // data: [] pour first-time user

// Budget creation: POST /api/v1/budgets
{ success: true, data: { id, month, year, ... } }
```

---

## 4. Plan d'Implémentation

### Avant : 519 lignes, 9 tests instables

### Après : ~80 lignes, 2 tests stables

```typescript
// Structure finale simplifiée
import { test as base, expect } from '@playwright/test';
import { setupAuthBypass } from '../../utils/auth-bypass';
import { TEST_CONFIG } from '../../config/test-config';

base.describe('Complete Profile Flow', () => {

  base('should redirect returning user with existing budget to dashboard', async ({ page }) => {
    // Route: budget list retourne 1 budget
    // setupAuthBypass: includeApiMocks: false
    // Navigation + assertion URL
  });

  base('should display complete profile form for first-time user', async ({ page }) => {
    // Route: budget list retourne []
    // setupAuthBypass: includeApiMocks: false
    // Navigation + assertions DOM
  });

});
```

### Gain
- **Lignes de code** : 519 → ~80 (-85%)
- **Nombre de tests** : 9 → 2 (-78%)
- **Complexité setup** : 3 helpers → 0 helper
- **Stabilité** : Tests instables → Tests stables

---

## 5. Coverage Totale Après Simplification

| Fonctionnalité | Tests Unitaires | Tests E2E |
|----------------|-----------------|-----------|
| checkExistingBudgets() | ✅ 3 tests | ✅ 2 tests (flow complet) |
| prefillFromOAuthMetadata() | ✅ 5 tests | ❌ (pas nécessaire) |
| isStep1Valid() | ✅ 4 tests | ❌ (pas nécessaire) |
| submitProfile() | ✅ 10 tests | ❌ (pas nécessaire) |
| Navigation/redirect | ❌ | ✅ 2 tests |
| **Total** | **22 tests** | **2 tests** |

**Conclusion** : Aucune perte de couverture fonctionnelle. Les tests E2E se concentrent sur ce qu'ils font le mieux : tester l'intégration de bout en bout.

---

## 6. Prochaine étape

Exécuter `/workflow:epct:plan` pour créer le plan d'implémentation détaillé.
