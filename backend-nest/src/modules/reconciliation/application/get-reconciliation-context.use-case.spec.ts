import { describe, expect, it, jest } from 'bun:test';
import { BusinessException } from '@common/exceptions/business.exception';
import type { ReconciliationStateRepositoryPort } from '../domain/ports/reconciliation-state-repository.port';
import type { BudgetWithDetails } from '@modules/budget/domain/budget.entity';
import type { BudgetMonthReadPort } from '@modules/budget/domain/ports/budget-month-read.port';
import { GetReconciliationContextUseCase } from './get-reconciliation-context.use-case';

const details = (
  id: string,
  previousBudgetId: string | null,
  over: object = {},
) =>
  ({
    budget: { id, endingBalance: 0 },
    budgetLines: [],
    transactions: [],
    previousBudgetId,
    ...over,
  }) as unknown as BudgetWithDetails;

function build(
  exists: boolean,
  lastCompletedAt: string | null = null,
  months: Record<string, BudgetWithDetails> = {},
) {
  const repo = {
    budgetExists: jest.fn().mockResolvedValue(exists),
    get: jest.fn().mockResolvedValue({ startingAmount: 3100, lastCompletedAt }),
  } as unknown as ReconciliationStateRepositoryPort;
  const budgets = {
    readBudget: jest.fn(async (id: string) => months[id] ?? null),
  };
  return {
    repo,
    budgets,
    useCase: new GetReconciliationContextUseCase(
      repo,
      budgets as unknown as BudgetMonthReadPort,
    ),
  };
}

describe('GetReconciliationContextUseCase', () => {
  it('should return the stored state with an empty prior part for a first budget', async () => {
    const { useCase } = build(true, '2026-11-01T10:00:00.000Z', {
      b1: details('b1', null),
    });

    expect(await useCase.execute('b1')).toEqual({
      startingAmount: 3100,
      hasCompletedComparison: true,
      priorCorrection: 0,
      priorItems: [],
    });
  });

  it('should follow the chain two budgets back, skipping missing months, and no further', async () => {
    const pending = (id: string, amount: number) => ({
      budget: { id, endingBalance: -amount },
      transactions: [
        {
          id,
          name: id,
          amount,
          kind: 'expense',
          budgetLineId: null,
          checkedAt: null,
        },
      ],
    });
    const { budgets, useCase } = build(true, null, {
      nov: details('nov', 'oct'),
      oct: details('oct', 'sep', pending('card', 800)),
      sep: details('sep', 'aug', pending('pharmacy', 40)),
      aug: details('aug', null, pending('old', 5)),
    });

    const context = await useCase.execute('nov');

    expect(context.priorItems.map((i) => [i.id, i.monthsAgo])).toEqual([
      ['card', 1],
      ['pharmacy', 2],
    ]);
    expect(context.priorCorrection).toBe(840);
    expect(budgets.readBudget).not.toHaveBeenCalledWith('aug');
  });

  it('should report no completed comparison without a completion time', async () => {
    const { useCase } = build(true);

    expect((await useCase.execute('b1')).hasCompletedComparison).toBe(false);
  });

  it('should refuse a budget that is not the person’s and read nothing else', async () => {
    const { repo, useCase } = build(false);

    await expect(useCase.execute('other')).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(repo.get).not.toHaveBeenCalled();
  });
});
