import { describe, expect, it } from 'bun:test';
import { BudgetFormulas, computeSavingsGoalProgress } from 'pulpe-shared';
import type {
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '@modules/budget/domain/budget.entity';
import type { BudgetMonthReadPort } from '@modules/budget/domain/ports/budget-month-read.port';
import type {
  SavingsGoal,
  SavingsGoalProgressComputation,
} from '@modules/savings-goal/domain/savings-goal.entity';
import type { SavingsGoalReadPort } from '@modules/savings-goal/domain/ports/savings-goal-read.port';
import { GetMonthTool } from './get-month.tool';
import { GetSavingsGoalOutlookTool } from './get-savings-goal-outlook.tool';
import { round } from './month-report';

/**
 * The whole point of the connector is that an agent quotes the same figures the
 * app shows. These tests pin every aggregate a read tool prints to the shared
 * calculator that produced it: change a calculator without the tool following,
 * and they fail here rather than in a conversation with a user.
 */

function line(over: Partial<BudgetLineDecrypted>): BudgetLineDecrypted {
  return {
    id: 'line',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    spreadGroupId: null,
    savingsWithdrawalGroupId: null,
    sourceSavingsGoalId: null,
    sourceSavingsGoalName: null,
    name: 'Ligne',
    amount: 0,
    originalAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    kind: 'expense',
    recurrence: 'one_off',
    tagIds: [],
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...over,
  };
}

function movement(over: Partial<TransactionDecrypted>): TransactionDecrypted {
  return {
    id: 'movement',
    budgetId: 'budget-1',
    budgetLineId: null,
    name: 'Mouvement',
    amount: 0,
    originalAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    kind: 'expense',
    transactionDate: '2026-03-12',
    tagIds: [],
    checkedAt: null,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    sourceSavingsGoalId: null,
    sourceSavingsGoalName: null,
    ...over,
  };
}

/** A month carrying a spread: three slices of one 2 400 insurance premium. */
const MONTH: BudgetWithDetails = {
  budget: {
    id: 'budget-1',
    userId: 'user-1',
    templateId: 'template-1',
    month: 3,
    year: 2026,
    description: 'Mars 2026',
    endingBalance: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  budgetLines: [
    line({
      id: 'l-1',
      name: 'Salaire',
      amount: 6200,
      kind: 'income',
      recurrence: 'fixed',
    }),
    line({ id: 'l-2', name: 'Loyer', amount: 1850, recurrence: 'fixed' }),
    line({
      id: 'l-3',
      name: 'Assurance (1/3)',
      amount: 800,
      spreadGroupId: 'spread-1',
      checkedAt: '2026-03-05T00:00:00.000Z',
    }),
    line({ id: 'l-4', name: 'Courses', amount: 640.55 }),
    line({
      id: 'l-5',
      name: 'Vacances',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
      savingsGoalId: 'goal-1',
    }),
  ],
  transactions: [
    movement({ id: 't-1', name: 'Migros', amount: 212.4, budgetLineId: 'l-4' }),
    movement({ id: 't-2', name: 'Coop', amount: 98.15, budgetLineId: 'l-4' }),
    movement({ id: 't-3', name: 'Restaurant', amount: 61.9 }),
  ],
  rollover: 143.27,
  previousBudgetId: 'budget-0',
};

describe('read tools · number concordance', () => {
  it('prints the month totals the shared budget formulas produce', async () => {
    const budgets = {
      readMonth: async () => MONTH,
      listMonths: async () => [],
    } satisfies BudgetMonthReadPort;

    const text = (
      await new GetMonthTool(budgets).execute({ month: 3, year: 2026 })
    ).text;

    const expected = BudgetFormulas.calculateAllMetrics(
      MONTH.budgetLines,
      MONTH.transactions,
      MONTH.rollover,
    );
    expect(text).toContain(
      `Revenus ${round(expected.totalIncome)} · Dépenses ${round(expected.totalExpenses)} · Épargne prévue ${round(expected.totalSavings)} · Report ${round(expected.rollover)} · Disponible à dépenser ${round(expected.remaining)}`,
    );
    // The spread slice is one prévision among the others, never a total of its own.
    expect(text).toContain(
      '[l-3] Dépense · Assurance (1/3) · 800 · Prévu · Pointé',
    );
  });

  it('prints the savings goal figures the shared progress calculator produces', async () => {
    const goal: SavingsGoal = {
      id: 'goal-1',
      userId: 'user-1',
      name: 'Vacances',
      startDate: '2026-01-01',
      targetAmount: 4000,
      targetDate: '2026-08-01',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      originalTargetAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
      initialAmount: null,
    };
    const computed = computeSavingsGoalProgress({
      targetAmount: goal.targetAmount,
      status: goal.status,
      createdAt: goal.createdAt,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      now: new Date('2026-03-20T12:00:00.000Z'),
      lines: [
        {
          id: 's-1',
          amount: 500,
          kind: 'saving',
          month: 1,
          year: 2026,
          checkedAt: '2026-01-28T00:00:00.000Z',
        },
        {
          id: 's-2',
          amount: 500,
          kind: 'saving',
          month: 2,
          year: 2026,
          checkedAt: '2026-02-27T00:00:00.000Z',
        },
        { id: 's-3', amount: 500, kind: 'saving', month: 3, year: 2026 },
      ],
      transactions: [{ budgetLineId: 's-3', amount: 180, kind: 'saving' }],
    });
    const outlook: SavingsGoalProgressComputation = {
      goal,
      computed,
      months: [],
    };
    const goals = {
      list: async () => [goal],
      outlook: async () => outlook,
    } satisfies SavingsGoalReadPort;

    const text = (
      await new GetSavingsGoalOutlookTool(goals).execute({
        savingsGoalId: 'goal-1',
      })
    ).text;

    expect(text).toContain(
      `Confirmé ${round(computed.confirmed)} · Prévu cumulé ${round(computed.plannedCumulative)} · Projection ${round(computed.plannedProjection)}`,
    );
    expect(text).toContain(
      `Rythme prévu ${round(computed.pace)} par mois · rythme confirmé ${round(computed.confirmedPace)} par mois`,
    );
    expect(text).toContain(
      `Mois écoulés ${computed.monthsElapsed} · mois restants ${computed.monthsRemaining}`,
    );
    // An in-progress goal: the projection exists and is not the target itself.
    expect(computed.achievementPercent).not.toBeNull();
    expect(text).toContain(
      `Avancement ${round(computed.achievementPercent!)} %`,
    );
  });
});
