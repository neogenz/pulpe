import { BudgetFormulas } from 'pulpe-shared';
import type { BudgetWithDetails } from '@modules/budget/domain/budget.entity';
import type { Tag } from '@modules/tag/domain/tag.entity';

export const KIND_LABEL = {
  income: 'Revenu',
  expense: 'Dépense',
  saving: 'Épargne',
} as const;

/** Same rounding as the app's display: no float noise reaches the model. */
export const round = (n: number): number => Number(n.toFixed(2));

export const tagNames = (tags: readonly Tag[]): ReadonlyMap<string, string> =>
  new Map(tags.map((tag) => [tag.id, tag.name]));

/**
 * The tag names of one line, ready to append to it. An id missing from `names`
 * (a tag deleted since the read) is skipped, never printed raw.
 */
export function tagSuffix(
  tagIds: readonly string[],
  names: ReadonlyMap<string, string>,
): string {
  const known = tagIds.flatMap((id) => names.get(id) ?? []);
  return known.length > 0 ? ` · Tags : ${known.join(', ')}` : '';
}

/**
 * One month in words. Shared by the current-month and given-month tools so an
 * agent never gets two different renderings of the same figures, and always
 * the ones `BudgetFormulas` produces for the app.
 */
export function renderMonth(
  details: BudgetWithDetails,
  names: ReadonlyMap<string, string> = new Map(),
): string {
  const { budget, budgetLines, transactions, rollover } = details;
  const m = BudgetFormulas.calculateAllMetrics(
    budgetLines,
    transactions,
    rollover,
  );

  // A live planned withdrawal is pointed once its allocated Réel covers it, never
  // through `checkedAt` (the server refuses to check it). Same rule as web
  // `budget-item-data-builder.ts` (`isPointed`) and iOS `BudgetLine.isPointed`.
  const isPointed = (l: (typeof budgetLines)[number]): boolean =>
    l.sourceSavingsGoalId
      ? BudgetFormulas.calculateConsumption(l, transactions).available <= 0
      : !!l.checkedAt;
  const lines = budgetLines.map(
    (l) =>
      `- [${l.id}] ${KIND_LABEL[l.kind]} · ${l.name} · ${round(l.amount)} · ${l.recurrence === 'fixed' ? 'Mensuel' : 'Ponctuel'} · ${isPointed(l) ? 'Pointé' : 'À pointer'}${tagSuffix(l.tagIds, names)}`,
  );
  // Keep the timezone: a UTC date alone can be the previous local day. The
  // forecast is named because an allocated movement keeps its nature and is
  // the only kind adjust_over_months can follow across months.
  const moves = transactions.map(
    (t) =>
      `- [${t.id}] ${KIND_LABEL[t.kind]} · ${t.name} · ${round(t.amount)} · ${t.transactionDate} · ${t.checkedAt ? 'Pointé' : 'À pointer'}${t.budgetLineId ? ` · Prévision [${t.budgetLineId}]` : ''}${tagSuffix(t.tagIds, names)}`,
  );

  return [
    `Budget ${budget.month}/${budget.year} (id ${budget.id})`,
    `Revenus ${round(m.totalIncome)} · Dépenses et épargne ${round(m.totalExpenses)} · Dont épargne prévue ${round(m.totalSavings)} · Report ${round(m.rollover)} · Disponible à dépenser ${round(m.remaining)}`,
    '',
    `Prévisions (${budgetLines.length})`,
    ...lines,
    '',
    `Mouvements (${transactions.length})`,
    ...moves,
  ].join('\n');
}
