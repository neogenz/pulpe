import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { RemoveSavingsGoalUseCase } from './remove-savings-goal.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('RemoveSavingsGoalUseCase', () => {
  let useCase: RemoveSavingsGoalUseCase;
  let mockRepo: {
    delete: ReturnType<typeof jest.fn>;
    applyDeletion: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let budgetRecalculation: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      applyDeletion: jest.fn().mockResolvedValue({
        touchedBudgetIds: ['budget-1', 'budget-2'],
      }),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    budgetRecalculation = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        RemoveSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: budgetRecalculation },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${RemoveSavingsGoalUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(RemoveSavingsGoalUseCase);
  });

  it('invalidates the user cache after FK unlink side effects', async () => {
    await useCase.execute('goal-1', mockUser);

    expect(mockRepo.delete).toHaveBeenCalledWith('goal-1');
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    expect(mockRepo.applyDeletion).not.toHaveBeenCalled();
    expect(budgetRecalculation.recalculate).not.toHaveBeenCalled();
  });

  it('does not invalidate cache when delete fails', async () => {
    const error = new Error('delete failed');
    mockRepo.delete.mockRejectedValueOnce(error);

    await expect(useCase.execute('goal-1', mockUser)).rejects.toThrow(error);

    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    expect(budgetRecalculation.recalculate).not.toHaveBeenCalled();
  });

  it('applies an explicit scope, invalidates cache and recalculates touched budgets', async () => {
    const command = {
      mode: 'goal_and_forecasts' as const,
      revision: { templateLines: [], budgetLines: [], transactions: [] },
    };

    await useCase.execute('goal-1', mockUser, command);

    expect(mockRepo.applyDeletion).toHaveBeenCalledWith('goal-1', command);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    expect(budgetRecalculation.recalculate.mock.calls).toEqual([
      ['budget-1'],
      ['budget-2'],
    ]);
  });

  it('maps a stale repository revision to the dedicated conflict', async () => {
    mockRepo.applyDeletion.mockRejectedValueOnce(
      new BusinessException(ERROR_DEFINITIONS.CONCURRENT_MODIFICATION),
    );

    await expect(
      useCase.execute('goal-1', mockUser, {
        mode: 'goal_only',
        revision: { templateLines: [], budgetLines: [], transactions: [] },
      }),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_DELETION_IMPACT_CHANGED',
      status: 409,
    });
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    expect(budgetRecalculation.recalculate).not.toHaveBeenCalled();
  });

  it('marks a recalculation failure as post-commit and non-retentable', async () => {
    const recalcError = new Error('recalc failed');
    budgetRecalculation.recalculate.mockRejectedValueOnce(recalcError);

    try {
      await useCase.execute('goal-1', mockUser, {
        mode: 'goal_forecasts_and_transactions',
        revision: { templateLines: [], budgetLines: [], transactions: [] },
      });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED',
      );
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.affectedBudgetIds).toEqual([
        'budget-1',
        'budget-2',
      ]);
    }
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('marks a cache invalidation failure as post-commit and non-retentable', async () => {
    const cacheError = new Error('cache invalidation failed');
    mockCache.invalidateForUser.mockRejectedValueOnce(cacheError);

    try {
      await useCase.execute('goal-1', mockUser, {
        mode: 'goal_forecasts_and_transactions',
        revision: { templateLines: [], budgetLines: [], transactions: [] },
      });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED',
      );
      expect(businessError.cause).toBe(cacheError);
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.affectedBudgetIds).toEqual([
        'budget-1',
        'budget-2',
      ]);
    }
    expect(budgetRecalculation.recalculate).not.toHaveBeenCalled();
  });

  it('marks a cache invalidation failure after legacy deletion as post-commit', async () => {
    const cacheError = new Error('cache invalidation failed');
    mockCache.invalidateForUser.mockRejectedValueOnce(cacheError);

    await expect(useCase.execute('goal-1', mockUser)).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED',
      cause: cacheError,
      loggingContext: {
        partialFailure: true,
        affectedBudgetIds: [],
        savingsGoalId: 'goal-1',
        userId: mockUser.id,
      },
    });
    expect(mockRepo.delete).toHaveBeenCalledWith('goal-1');
    expect(budgetRecalculation.recalculate).not.toHaveBeenCalled();
  });
});
