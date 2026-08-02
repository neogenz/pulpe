import type {
  DemoSeededBudget,
  DemoSeededBudgetLine,
  DemoTransactionSeed,
} from './demo.entity';
import { isClosedMonth, templateKeyForMonth } from './demo-seed.builders';
import type { DemoTemplateKey } from './demo.constants';

interface MonthTransactionSpec {
  day: number;
  name: string;
  amount: number;
  tagName: string;
  envelopeName: string;
}

/**
 * The month's actuals, one set per template. `envelopeName` names the prévision
 * each one consumes, and it must exist in the template it is filed under: a
 * themed month whose actuals named standard envelopes showed a budget with
 * nothing consumed at all — the very emptiness the demo exists to disprove.
 * `demo-template-specs.spec.ts` holds the two sides together.
 *
 * The month in progress only keeps the actuals whose day has already elapsed,
 * so every set opens on the 1st: a prospect landing on the 2nd must still see a
 * consumed envelope.
 */
export const MONTH_TRANSACTION_SPECS: Record<
  DemoTemplateKey,
  readonly MonthTransactionSpec[]
> = {
  STANDARD: [
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
  ],
  VACATIONS: [
    {
      day: 1,
      name: 'Swiss - Billets',
      amount: 742,
      tagName: 'Voyage',
      envelopeName: "Billets d'avion",
    },
    {
      day: 10,
      name: 'Hôtel Bellavista',
      amount: 1180,
      tagName: 'Voyage',
      envelopeName: 'Hôtel (7 nuits)',
    },
    {
      day: 15,
      name: 'Excursions & restaurants',
      amount: 486.3,
      tagName: 'Loisirs',
      envelopeName: 'Budget vacances',
    },
  ],
  SAVINGS: [
    {
      day: 1,
      name: 'Aldi - Courses',
      amount: 68.3,
      tagName: 'Alimentation',
      envelopeName: 'Courses (budget serré)',
    },
    {
      day: 10,
      name: 'Denner - Courses',
      amount: 74.15,
      tagName: 'Alimentation',
      envelopeName: 'Courses (budget serré)',
    },
    {
      day: 15,
      name: 'Pharmacie - dépannage',
      amount: 42.9,
      tagName: 'Santé',
      envelopeName: 'Minimum vital',
    },
  ],
  HOLIDAYS: [
    {
      day: 1,
      name: 'Manor - Cadeaux',
      amount: 245,
      tagName: 'Cadeaux',
      envelopeName: 'Cadeaux famille',
    },
    {
      day: 10,
      name: 'Traiteur - Repas de fêtes',
      amount: 318.5,
      tagName: 'Alimentation',
      envelopeName: 'Repas de fêtes',
    },
    {
      day: 15,
      name: 'Jumbo - Décorations',
      amount: 87.9,
      tagName: 'Maison',
      envelopeName: 'Décorations',
    },
  ],
};

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
  const specs = MONTH_TRANSACTION_SPECS[templateKeyForMonth(budget.month)];

  return specs
    .filter((spec) => maxDay >= spec.day)
    .map((spec) => {
      // UTC midnight, like the settlement stamp: a local midnight would land on
      // the day before whenever the seeding server sits east of UTC.
      const transactionDate = new Date(
        Date.UTC(budget.year, budget.month - 1, spec.day),
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
    });
}
