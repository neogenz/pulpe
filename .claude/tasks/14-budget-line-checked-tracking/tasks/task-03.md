# Task: Budget Formulas - Calcul du solde réalisé

## Problem

Les formules de calcul budgétaire ne permettent pas de calculer un "solde réalisé" distinct du solde prévisionnel. Les utilisateurs ont besoin de voir combien ils ont réellement gagné/dépensé basé sur les lignes qu'ils ont cochées comme réalisées.

## Proposed Solution

Ajouter de nouvelles méthodes à la classe `BudgetFormulas` pour calculer les revenus réalisés, dépenses réalisées, et le solde réalisé en filtrant uniquement les lignes avec `checkedAt !== null`.

## Dependencies

- Task #2: Shared Schema (pour le type BudgetLine avec checkedAt)

## Context

- Fichier: `shared/src/calculators/budget-formulas.ts`
- Interface `FinancialItem` (ligne ~31): doit inclure `checkedAt`
- Méthodes existantes à suivre comme pattern:
  - `calculateTotalIncome` (lignes 49-62)
  - `calculateTotalExpenses` (lignes 74-87)
- `calculateAllMetrics` (ligne 138-160) doit être étendu pour retourner `realizedBalance`

## Success Criteria

- Interface `FinancialItem` étendue avec `checkedAt?: string | null`
- Méthode `calculateRealizedIncome(budgetLines)` créée
- Méthode `calculateRealizedExpenses(budgetLines)` créée
- Méthode `calculateRealizedBalance(budgetLines)` créée (income - expenses)
- `calculateAllMetrics` retourne `realizedBalance` dans son objet de retour
- Tests unitaires couvrent les nouveaux calculs
- Formule: `realizedBalance = Σ(revenus cochés) - Σ(dépenses cochées) - Σ(épargnes cochées)`
