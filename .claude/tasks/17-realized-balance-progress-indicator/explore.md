# Task 17: Realized Balance Progress Indicator

## Description

Ajouter un indicateur de progression sur le "solde actuel (coché)" dans les écrans:
- Mois courant (`current-month.ts`)
- Détails du budget (`budget-financial-overview.ts`)

**Layout demandé:**
- Gauche: Total des dépenses cochées (montant en CHF)
- Droite: Solde actuel (montant en CHF)
- Dessous: Barre de progression basée sur le ratio d'éléments cochés + label "X/Y" (ex: 12/28)
- Style: similaire à `pulpe-budget-progress-bar`

---

## Design Visuel

```
┌─────────────────────────────────────────────────┐
│ Dépenses réalisées CHF       Solde actuel CHF   │
│ 1'250.00                              750.00    │
├─────────────────────────────────────────────────┤
│ [████████████░░░░░░░░░░░░░░░░░░░░]              │
│ 12/28 éléments vérifiés                         │
└─────────────────────────────────────────────────┘
```

**Données affichées:**
| Position | Donnée | Source |
|----------|--------|--------|
| Gauche | Dépenses réalisées CHF | `BudgetFormulas.calculateRealizedExpenses()` |
| Droite | Solde actuel CHF | `store.realizedBalance()` |
| Barre | % éléments cochés | `(checkedCount / totalCount) * 100` |
| Label | "X/Y éléments vérifiés" | Budget lines + transactions groupés |

---

## Codebase Context

### Budget Progress Bar (Modèle de référence)
**File:** `frontend/projects/webapp/src/app/feature/current-month/components/budget-progress-bar.ts`

**Structure:**
```html
<mat-card appearance="outlined">
  <mat-card-header class="mb-4">
    <div class="flex justify-between items-baseline gap-2 w-full">
      <!-- Gauche: Dépenses CHF -->
      <div class="flex flex-col">
        <span class="text-body-small md:text-body">Dépenses CHF</span>
        <span class="text-headline-small md:text-headline-large">{{ amount }}</span>
      </div>
      <!-- Droite: Disponible CHF -->
      <div class="flex flex-col text-right">
        <span class="text-body-small md:text-body">Disponible CHF</span>
        <span class="text-headline-small md:text-headline-large">{{ amount }}</span>
      </div>
    </div>
  </mat-card-header>
  <mat-card-content class="space-y-2">
    <mat-progress-bar mode="determinate" [value]="percentage" />
    <div class="text-label-small text-on-surface-variant">
      {{ percentage }}% du budget dépensé
    </div>
  </mat-card-content>
</mat-card>
```

**Styling:**
- Progress bar height: 10px (via SCSS override)
- Over-budget: `--mat-sys-error` color
- Typography: `text-headline-small`, `text-body-small`, `text-label-small`
- Colors: `text-on-surface-variant`, `text-financial-income`, `text-financial-negative`

### Affichage Actuel du Solde Réalisé

**Current Month:** `current-month.ts:149-154`
```html
<pulpe-financial-summary [data]="realizedBalanceData()">
  <pulpe-realized-balance-tooltip slot="title-info" />
</pulpe-financial-summary>
```

**Budget Details:** `budget-financial-overview.ts:28-30`
```html
<pulpe-financial-summary [data]="realizedBalanceData()" />
```

### Calculs Existants

**File:** `frontend/projects/shared/src/lib/budget/budget-formulas.ts`

```typescript
// Ligne 153-166: Calcul du solde réalisé
static calculateRealizedBalance(budgetLines, transactions): number {
  const realizedIncome = this.calculateRealizedIncome(budgetLines, transactions);
  const realizedExpenses = this.calculateRealizedExpenses(budgetLines, transactions);
  return realizedIncome - realizedExpenses;
}

// Ligne 123-143: Calcul des dépenses réalisées
static calculateRealizedExpenses(budgetLines, transactions): number {
  const checkedBudgetExpenses = budgetLines
    .filter(line => line.checkedAt != null && (line.kind === 'expense' || line.kind === 'saving'))
    .reduce((sum, line) => sum + line.amount, 0);
  const checkedTransactionExpenses = transactions
    .filter(t => t.checkedAt != null && (t.kind === 'expense' || t.kind === 'saving'))
    .reduce((sum, t) => sum + t.amount, 0);
  return checkedBudgetExpenses + checkedTransactionExpenses;
}
```

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `current-month/components/budget-progress-bar.ts` | Composant de référence pour le style | Full |
| `current-month/current-month.ts` | Affichage actuel du solde réalisé | 149-154 |
| `current-month/services/current-month-store.ts` | `realizedBalance()` computed | 168-174 |
| `budget/budget-details/budget-financial-overview.ts` | Affichage budget details | 28-30 |
| `budget/budget-details/services/budget-details-store.ts` | `realizedBalance()` computed | 108-115 |
| `shared/src/lib/budget/budget-formulas.ts` | Calculs realized income/expenses | 98-166 |
| `ui/financial-summary/financial-summary.ts` | Composant d'affichage actuel | Full |

---

## Data Available in Stores

### Current Month Store (`current-month-store.ts`)

| Signal | Type | Description |
|--------|------|-------------|
| `budgetLines()` | `BudgetLine[]` | Budget lines avec `checkedAt` |
| `transactions()` | `Transaction[]` | Transactions avec `checkedAt` |
| `realizedBalance()` | `number` | Solde réalisé calculé |
| **À ajouter** | | |
| `checkedItemsCount()` | `number` | Nombre d'éléments cochés |
| `totalItemsCount()` | `number` | Nombre total d'éléments |
| `realizedExpenses()` | `number` | Dépenses réalisées |

### Budget Details Store (`budget-details-store.ts`)

| Signal | Type | Description |
|--------|------|-------------|
| `displayBudgetLines()` | `BudgetLine[]` | Budget lines incluant rollover |
| `budgetDetails().transactions` | `Transaction[]` | Transactions |
| `realizedBalance()` | `number` | Solde réalisé calculé |
| **À ajouter** | | |
| `checkedItemsCount()` | `number` | Nombre d'éléments cochés |
| `totalItemsCount()` | `number` | Nombre total d'éléments |
| `realizedExpenses()` | `number` | Dépenses réalisées |

---

## Patterns to Follow

1. **Component:** Standalone, OnPush, signal inputs
2. **Styling:** Tailwind + Material tokens (comme budget-progress-bar)
3. **Progress bar:** `MatProgressBarModule` avec overrides SCSS pour height
4. **State:** Computed signals pour les calculs dérivés
5. **Typography:** Material Design 3 tokens (`text-headline-small`, etc.)

---

## Decisions Made

| Question | Décision |
|----------|----------|
| Séparation budget lines vs transactions | **Tout groupé** - un seul compteur |
| Montant gauche | Dépenses réalisées (cochées) en CHF |
| Montant droite | Solde actuel (revenus - dépenses cochés) |
| Barre de progression | Ratio d'éléments cochés (pas montants) |

---

## Implementation Summary

1. **Créer** nouveau composant `RealizedBalanceProgressBar` dans `ui/`
2. **Ajouter** 3 computed signals dans `CurrentMonthStore`
3. **Ajouter** 3 computed signals dans `BudgetDetailsStore`
4. **Remplacer** `<pulpe-financial-summary>` dans `current-month.ts`
5. **Remplacer** `<pulpe-financial-summary>` dans `budget-financial-overview.ts`
