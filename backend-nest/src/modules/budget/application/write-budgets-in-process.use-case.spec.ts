import { beforeEach, describe, expect, it, jest } from 'bun:test';
import type { BudgetDeletionImpact } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetRepositoryPort } from '../domain/ports/budget-repository.port';
import type { Budget } from '../domain/budget.entity';
import type { CreateBudgetUseCase } from './create-budget.use-case';
import type { RemoveBudgetUseCase } from './remove-budget.use-case';
import type { GetBudgetDeletionImpactUseCase } from './get-budget-deletion-impact.use-case';
import { WriteBudgetsInProcessUseCase } from './write-budgets-in-process.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const impact: BudgetDeletionImpact = {
  forecastCount: 3,
  movementCount: 1,
  links: {
    spreadForecasts: 1,
    savingsGoalForecasts: 0,
    savingsWithdrawalForecasts: 0,
    savingsWithdrawalMovements: 0,
  },
};

describe('WriteBudgetsInProcessUseCase', () => {
  let createBudget: { execute: ReturnType<typeof jest.fn> };
  let removeBudget: { execute: ReturnType<typeof jest.fn> };
  let getDeletionImpact: { execute: ReturnType<typeof jest.fn> };
  let repo: { fetchBudgetIdByPeriod: ReturnType<typeof jest.fn> };
  let adapter: WriteBudgetsInProcessUseCase;

  beforeEach(() => {
    createBudget = { execute: jest.fn() };
    removeBudget = { execute: jest.fn().mockResolvedValue(impact) };
    getDeletionImpact = { execute: jest.fn().mockResolvedValue(impact) };
    repo = { fetchBudgetIdByPeriod: jest.fn().mockResolvedValue('budget-1') };
    adapter = new WriteBudgetsInProcessUseCase(
      createBudget as unknown as CreateBudgetUseCase,
      removeBudget as unknown as RemoveBudgetUseCase,
      getDeletionImpact as unknown as GetBudgetDeletionImpactUseCase,
      repo as unknown as BudgetRepositoryPort,
      { user } as unknown as AuthenticatedSupabaseProvider,
    );
  });

  it('should resolve the month to its budget id and read the impact as the session user', async () => {
    const result = await adapter.deletionImpact(3, 2027);

    expect(repo.fetchBudgetIdByPeriod).toHaveBeenCalledWith(3, 2027);
    expect(getDeletionImpact.execute).toHaveBeenCalledWith('budget-1', user);
    expect(result).toBe(impact);
  });

  it('should pass the session user and confirmLinks through when removing a month', async () => {
    const result = await adapter.removeMonth(3, 2027, true);

    expect(removeBudget.execute).toHaveBeenCalledWith('budget-1', user, true);
    expect(result).toBe(impact);

    await adapter.removeMonth(3, 2027, false);

    expect(removeBudget.execute).toHaveBeenLastCalledWith(
      'budget-1',
      user,
      false,
    );
  });

  it('should answer 404 for a month without budget and touch nothing', async () => {
    repo.fetchBudgetIdByPeriod.mockResolvedValue(null);

    for (const call of [
      () => adapter.deletionImpact(3, 2027),
      () => adapter.removeMonth(3, 2027, true),
    ]) {
      const error = await call().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND.code,
      );
      expect((error as BusinessException).getStatus()).toBe(404);
    }
    expect(getDeletionImpact.execute).not.toHaveBeenCalled();
    expect(removeBudget.execute).not.toHaveBeenCalled();
  });

  it('should create a month from a template as the session user', async () => {
    const budget = { id: 'budget-2', month: 4, year: 2027 } as Budget;
    createBudget.execute.mockResolvedValue(budget);
    const dto = {
      month: 4,
      year: 2027,
      templateId: 'template-1',
      description: '',
    };

    const result = await adapter.createFromTemplate(dto);

    expect(createBudget.execute).toHaveBeenCalledWith(dto, user);
    expect(result).toBe(budget);
  });
});
