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
  months: Record<string, BudgetWithDetails> = {},
  lastCompletedAt: string | null = null,
) {
  const repo = {
    get: jest.fn().mockResolvedValue({ lastCompletedAt }),
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
  it('should return the completion with every deprecated key at its empty value', async () => {
    const { useCase } = build(
      { b1: details('b1', null) },
      '2026-11-01T10:00:00.000Z',
    );

    expect(await useCase.execute('b1')).toEqual({
      startingAmount: 0,
      hasCompletedComparison: true,
      priorCorrection: 0,
      priorItems: [],
    });
  });

  it('should never read or count a previous budget', async () => {
    const { budgets, useCase } = build({
      nov: details('nov', 'oct'),
      oct: details('oct', null, { budget: { id: 'oct', endingBalance: -800 } }),
    });

    const context = await useCase.execute('nov');

    expect(context.priorCorrection).toBe(0);
    expect(context.priorItems).toEqual([]);
    expect(budgets.readBudget).toHaveBeenCalledTimes(1);
  });

  it('should report no completed comparison without a completion time', async () => {
    const { useCase } = build({ b1: details('b1', null) });

    expect((await useCase.execute('b1')).hasCompletedComparison).toBe(false);
  });

  it('should refuse a budget that is not the person’s and read nothing else', async () => {
    const { repo, budgets, useCase } = build();

    await expect(useCase.execute('other')).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(repo.get).not.toHaveBeenCalled();
    expect(budgets.readBudget).toHaveBeenCalledTimes(1);
  });
});
