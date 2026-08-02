import type {
  DemoSeededBudget,
  DemoSeededBudgetLine,
  DemoTransactionSeed,
} from './demo.entity';
import { isClosedMonth } from './demo-seed.builders';

/**
 * The month's actuals. `envelopeName` names the prévision each one consumes —
 * a budget built from another template may not carry it, and the actual then
 * stays unattached, which is a legitimate state to show.
 *
 * The month in progress only keeps the actuals whose day has already elapsed,
 * so the first one falls on the 1st: a prospect opening the demo on the 2nd
 * must still see a consumed envelope, not the empty month the seed used to show
 * until the 5th.
 */
const MONTH_TRANSACTION_SPECS = [
  {
    day: 1,
    name: 'Migros - Courses',
    amount: 127.85,
    tagName: 'Alimentation',
    envelopeName: 'Courses alimentaires',
  },
  {
    day: 10,
    name: 'Restaurant Molino',
    amount: 78.5,
    tagName: 'Restaurants',
    envelopeName: 'Restaurants/Sorties',
  },
  {
    day: 15,
    name: 'Coop - Courses',
    amount: 94.2,
    tagName: 'Alimentation',
    envelopeName: 'Courses alimentaires',
  },
] as const;

export function buildTransactionSeeds(
  budgets: DemoSeededBudget[],
  budgetLines: DemoSeededBudgetLine[],
  currentDate: Date,
): DemoTransactionSeed[] {
  const pastBudgets = budgets.filter((budget) => {
    const budgetDate = new Date(budget.year, budget.month - 1);
    return budgetDate <= currentDate;
  });

  const envelopesByBudget = new Map<string, DemoSeededBudgetLine[]>();
  for (const line of budgetLines) {
    const existing = envelopesByBudget.get(line.budgetId);
    if (existing) existing.push(line);
    else envelopesByBudget.set(line.budgetId, [line]);
  }

  const transactions: DemoTransactionSeed[] = [];

  for (const budget of pastBudgets) {
    const isCurrentMonth =
      budget.month === currentDate.getMonth() + 1 &&
      budget.year === currentDate.getFullYear();
    const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
    const maxDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;

    transactions.push(
      ...buildMonthTransactions(
        budget,
        maxDay,
        envelopesByBudget.get(budget.id) ?? [],
        currentDate,
      ),
    );
  }

  return transactions;
}

function buildMonthTransactions(
  budget: DemoSeededBudget,
  maxDay: number,
  envelopes: DemoSeededBudgetLine[],
  currentDate: Date,
): DemoTransactionSeed[] {
  const isClosed = isClosedMonth(budget, currentDate);

  return MONTH_TRANSACTION_SPECS.filter((spec) => maxDay >= spec.day).map(
    (spec) => {
      const transactionDate = new Date(
        budget.year,
        budget.month - 1,
        spec.day,
      ).toISOString();

      return {
        budgetId: budget.id,
        budgetLineId:
          envelopes.find((line) => line.name === spec.envelopeName)?.id ?? null,
        name: spec.name,
        amount: spec.amount,
        kind: 'expense',
        tagName: spec.tagName,
        transactionDate,
        checkedAt: isClosed ? transactionDate : null,
      };
    },
  );
}
