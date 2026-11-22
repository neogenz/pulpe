import { describe, expect, it, mock } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetWithDetails } from '../domain/budget.entity';
import { ReadBudgetMonthUseCase } from './read-budget-month.use-case';

const found = { budget: { id: 'b1' } } as BudgetWithDetails;

function build(
  execute: (...args: unknown[]) => Promise<BudgetWithDetails>,
  spy = mock(execute),
) {
  return new ReadBudgetMonthUseCase(
    {} as never,
    { execute: spy } as never,
    {} as never,
    { user: { id: 'u' } } as never,
  );
}

describe('ReadBudgetMonthUseCase.readBudget', () => {
  it('should return the budget with its details', async () => {
    expect(await build(async () => found).readBudget('b1')).toBe(found);
  });

  it('should read fresh, never from the cache', async () => {
    const spy = mock(async (..._args: unknown[]) => found);

    await build(async () => found, spy).readBudget('b1');

    expect(spy.mock.calls[0]?.[2]).toEqual({ fresh: true });
  });

  it('should return null for a missing or foreign id', async () => {
    const notFound = build(async () => {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
        id: 'x',
      });
    });

    expect(await notFound.readBudget('x')).toBeNull();
  });

  it('should not hide a read failure', async () => {
    const failing = build(async () => {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_FETCH_FAILED);
    });

    await expect(failing.readBudget('b1')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });
});
