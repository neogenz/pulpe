import type {
  DemoSeededBudget,
  DemoSeededBudgetLine,
  DemoTransactionSeed,
} from './demo.entity';
import {
  isClosedMonth,
  templateKeyForMonth,
  utcMidnight,
} from './demo-seed.builders';
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
  const envelopesByBudget = new Map<string, DemoSeededBudgetLine[]>();
  for (const line of budgetLines) {
    const existing = envelopesByBudget.get(line.budgetId);
    if (existing) existing.push(line);
    else envelopesByBudget.set(line.budgetId, [line]);
  }

  return budgets.flatMap((budget) =>
    buildMonthTransactions(
      budget,
      envelopesByBudget.get(budget.id) ?? [],
      currentDate,
    ),
  );
}

function buildMonthTransactions(
  budget: DemoSeededBudget,
  envelopes: DemoSeededBudgetLine[],
  currentDate: Date,
): DemoTransactionSeed[] {
  const isClosed = isClosedMonth(budget, currentDate);
  const specs = MONTH_TRANSACTION_SPECS[templateKeyForMonth(budget.month)];

  /**
   * A day is admitted by the very instant it will be stamped with, so a réel is
   * never dated ahead of the clock that seeded it. Gating on the local calendar
   * instead would let the seeding server's own midnight through hours before
   * the stamped one, and months still ahead never clear the test at all.
   */
  return specs
    .map((spec) => ({
      spec,
      stamp: utcMidnight(budget.year, budget.month, spec.day),
    }))
    .filter(({ stamp }) => stamp <= currentDate)
    .map(({ spec, stamp }) => {
      const transactionDate = stamp.toISOString();

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
