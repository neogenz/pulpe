import { BudgetFormulas } from 'pulpe-shared';
import type { BudgetWithDetails } from '@modules/budget/domain/budget.entity';

export const KIND_LABEL = {
  income: 'Revenu',
  expense: 'Dépense',
  saving: 'Épargne',
} as const;

/** Same rounding as the app's display: no float noise reaches the model. */
export const round = (n: number): number => Number(n.toFixed(2));

/**
 * One month in words. Shared by the current-month and given-month tools so an
 * agent never gets two different renderings of the same figures, and always
 * the ones `BudgetFormulas` produces for the app.
 */
export function renderMonth(details: BudgetWithDetails): string {
  const { budget, budgetLines, transactions, rollover } = details;
  const m = BudgetFormulas.calculateAllMetrics(
    budgetLines,
    transactions,
    rollover,
  );

  const lines = budgetLines.map(
    (l) =>
      `- [${l.id}] ${KIND_LABEL[l.kind]} · ${l.name} · ${round(l.amount)} · ${l.recurrence === 'fixed' ? 'Récurrent' : 'Prévu'}${l.checkedAt ? ' · Pointé' : ''}`,
  );
  const moves = transactions.map(
    (t) =>
      `- [${t.id}] ${KIND_LABEL[t.kind]} · ${t.name} · ${round(t.amount)} · ${t.transactionDate.slice(0, 10)}${t.checkedAt ? ' · Pointé' : ''}`,
  );

  return [
    `Budget ${budget.month}/${budget.year} (id ${budget.id})`,
    `Revenus ${round(m.totalIncome)} · Dépenses ${round(m.totalExpenses)} · Épargne prévue ${round(m.totalSavings)} · Report ${round(m.rollover)} · Disponible à dépenser ${round(m.remaining)}`,
    '',
    `Prévisions (${budgetLines.length})`,
    ...lines,
    '',
    `Mouvements (${transactions.length})`,
    ...moves,
  ].join('\n');
}
