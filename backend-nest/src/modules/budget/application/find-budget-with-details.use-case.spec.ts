import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { FindBudgetWithDetailsUseCase } from './find-budget-with-details.use-case';
import type { Budget } from '../domain/budget.entity';
import type { HistoryMonth } from '../domain/drift-history';

const USER = {
  id: 'user-1',
  email: 'u@test',
  clientKey: Buffer.from('k'),
} as never;

const makeBudget = (id: string, month: number, year: number): Budget => ({
  id,
  userId: 'user-1',
  templateId: 'tmpl',
  month,
  year,
  description: `${year}-${month}`,
  endingBalance: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const closedMonth = (month: number, year: number): HistoryMonth => ({
  month,
  year,
  budgetLines: [
    {
      id: `l-${month}`,
      kind: 'expense',
      amount: 1000,
      checkedAt: '2026-01-31',
    },
  ],
  transactions: [
    {
      kind: 'expense',
      amount: 100,
      budgetLineId: null,
      transactionDate: `${year}-${String(month).padStart(2, '0')}-10`,
    },
  ],
});

describe('FindBudgetWithDetailsUseCase — drift history', () => {
  const current = makeBudget('cur', 8, 2026);
  const budgets = [
    makeBudget('next', 9, 2026),
    current,
    makeBudget('jul', 7, 2026),
    makeBudget('jun', 6, 2026),
  ];
  let repo: {
    fetchBudgetData: ReturnType<typeof mock>;
    fetchAllBudgets: ReturnType<typeof mock>;
    fetchHistoryData: ReturnType<typeof mock>;
  };
  let useCase: FindBudgetWithDetailsUseCase;
  // Calendar months (pay day 1); the demo user has no payDayOfMonth metadata.
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { user_metadata: {} } } }) },
  } as never;

  beforeEach(() => {
    repo = {
      fetchBudgetData: mock(async () => ({
        budget: current,
        budgetLines: [],
        transactions: [],
      })),
      fetchAllBudgets: mock(async () => budgets),
      fetchHistoryData: mock(
        async (previous: { month: number; year: number }[]) =>
          previous.map((b) => closedMonth(b.month, b.year)),
      ),
    };
    useCase = new FindBudgetWithDetailsUseCase(
      repo as never,
      {
        getOrSet: (_u: string, _k: string, _ttl: number, fn: () => unknown) =>
          fn(),
      } as never,
      {
        getRollover: async () => ({ rollover: 0, previousBudgetId: 'jul' }),
      } as never,
      { info: mock(() => {}) } as never,
    );
  });

  it('attaches the history of the budgets strictly before this one, newest first', async () => {
    const result = await useCase.execute('cur', USER, supabase);

    expect(repo.fetchHistoryData).toHaveBeenCalledWith([
      budgets[2],
      budgets[3],
    ]);
    expect(result.history).toEqual({
      usualOutflowDrift: -0.1,
      closedMonths: 2,
      priorStrength: expect.any(Number),
      driftMad: 0,
      driftProfile: [0, 1, 1, 1],
    });
  });

  it('history is null when no closed month precedes the budget', async () => {
    repo.fetchHistoryData = mock(async () => []);

    const result = await useCase.execute('cur', USER, supabase);

    expect(result.history).toBeNull();
  });
});
