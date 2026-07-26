import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { ApplySavingsGoalGenerationStopUseCase } from './apply-savings-goal-generation-stop.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('ApplySavingsGoalGenerationStopUseCase', () => {
  let useCase: ApplySavingsGoalGenerationStopUseCase;
  let repo: {
    findById: ReturnType<typeof jest.fn>;
    applyGenerationStop: ReturnType<typeof jest.fn>;
  };
  let budgetRecalculation: { recalculate: ReturnType<typeof jest.fn> };
  let cache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    repo = {
      findById: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      applyGenerationStop: jest.fn().mockResolvedValue({
        affectedLineIds: ['line-1'],
        touchedBudgetIds: ['budget-1'],
      }),
    };
    budgetRecalculation = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };
    cache = {
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApplySavingsGoalGenerationStopUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: budgetRecalculation },
        { provide: CacheService, useValue: cache },
        {
          provide: `INFO_LOGGER:${ApplySavingsGoalGenerationStopUseCase.name}`,
          useValue: {
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(ApplySavingsGoalGenerationStopUseCase);
  });

  it('applies the decision, refreshes touched budgets, and invalidates the cache', async () => {
    const result = await useCase.execute(
      'goal-1',
      { mode: 'freeze', budgetLineIds: ['line-1'] },
      mockUser,
    );

    expect(result).toEqual({ affectedCount: 1 });
    expect(budgetRecalculation.recalculate).toHaveBeenCalledWith('budget-1');
    expect(cache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('distinguishes a committed decision when recalculation fails', async () => {
    const recalcError = new Error('recalc failed');
    budgetRecalculation.recalculate.mockRejectedValue(recalcError);

    try {
      await useCase.execute(
        'goal-1',
        { mode: 'remove', budgetLineIds: ['line-1'] },
        mockUser,
      );
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED',
      );
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.affectedBudgetIds).toEqual([
        'budget-1',
      ]);
    }
    expect(cache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
