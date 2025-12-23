# Task: Tests E2E Playwright

## Problem

Pas de tests end-to-end pour valider le parcours utilisateur complet des transactions allouées. Il faut s'assurer que toutes les fonctionnalités marchent ensemble et que les régressions sont détectées.

## Proposed Solution

Créer une suite de tests Playwright couvrant les scénarios principaux: création, modification, suppression de transactions allouées, vérification des calculs, et régression des transactions libres.

## Dependencies

- Task 8: CRUD Actions + Store (toutes fonctionnalités implémentées)

## Context

- Tests E2E: `frontend/projects/webapp-e2e/tests/`
- Pattern Playwright existant dans le projet
- Commande: `pnpm test:e2e`
- Tests responsive: mobile et desktop

## Success Criteria

- Suite `budget-allocated-transactions.spec.ts` créée:
  - **Scénario 1 - Création:**
    - Given: Budget avec BudgetLine "Essence" 120 CHF
    - When: Ouvrir dialog, ajouter transaction 65 CHF
    - Then: Transaction visible, montants mis à jour (65 dépensés, 55 restants)
  - **Scénario 2 - Modification:**
    - Given: Transaction existante
    - When: Éditer montant
    - Then: Montant modifié, calculs recalculés
  - **Scénario 3 - Suppression:**
    - Given: Transaction existante
    - When: Supprimer avec confirmation
    - Then: Transaction disparue, montants recalculés
  - **Scénario 4 - Calculs multiples:**
    - Given: Multiple transactions
    - Then: Somme correcte, remaining global correct
  - **Scénario 5 - Régression transactions libres:**
    - Transaction sans budgetLineId continue de fonctionner
  - **Tests responsive:** Mobile (menu) + Desktop (boutons)
- Tous les tests passent en CI
