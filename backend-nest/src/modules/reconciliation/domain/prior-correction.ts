import {
  BudgetFormulas,
  moneyDifference,
  pointingEffects,
  type ReconciliationPriorItem,
} from 'pulpe-shared';
import type { BudgetWithDetails } from '@modules/budget/domain/budget.entity';

export interface PriorMonth {
  readonly details: BudgetWithDetails;
  readonly monthsAgo: 1 | 2;
}

/**
 * What the rollover counted as spent or received but nobody checked, for the
 * previous budgets: `realizedNet − storedEndingBalance` each (a null stored
 * balance counts as 0, like the rollover does), summed. The unchecked items
 * behind it come with the effect pointing them has on the compared figure.
 */
export function priorCorrection(months: readonly PriorMonth[]): {
  priorCorrection: number;
  priorItems: ReconciliationPriorItem[];
} {
  let correction = 0;
  const priorItems: ReconciliationPriorItem[] = [];
  for (const { details, monthsAgo } of months) {
    const { budget, budgetLines, transactions } = details;
    correction = moneyDifference(
      correction,
      moneyDifference(
        budget.endingBalance ?? 0,
        BudgetFormulas.calculateRealizedBalance(budgetLines, transactions),
      ),
    );
    const items = [
      // A planned savings withdrawal is realized by its real income: the API refuses to check it.
      ...budgetLines
        .filter((l) => l.checkedAt == null && !l.sourceSavingsGoalId)
        .map((l) => ({ source: 'budgetLine' as const, ...l })),
      ...transactions
        .filter((t) => t.checkedAt == null)
        .map((t) => ({ source: 'transaction' as const, ...t })),
    ];
    const effects = pointingEffects(
      budgetLines,
      transactions,
      items.map(({ source, id }) => ({ kind: source, id })),
    );
    items.forEach(({ source, id, name, amount, kind }, i) => {
      const effect = effects[i]!;
      if (effect !== 0)
        priorItems.push({
          id,
          source,
          budgetId: budget.id,
          name,
          amount,
          kind,
          monthsAgo,
          effect,
        });
    });
  }
  return { priorCorrection: correction, priorItems };
}
