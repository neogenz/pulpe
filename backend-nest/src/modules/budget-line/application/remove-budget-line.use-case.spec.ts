import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { RemoveBudgetLineUseCase } from './remove-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('RemoveBudgetLineUseCase', () => {
  let useCase: RemoveBudgetLineUseCase;
  let mockRepo: {
    fetchBudgetIdForLine: ReturnType<typeof jest.fn>;
    delete: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let callOrder: string[];

  beforeEach(async () => {
    callOrder = [];
    mockRepo = {
      fetchBudgetIdForLine: jest.fn().mockImplementation(async () => {
        callOrder.push('fetchBudgetIdForLine');
        return 'budget-1';
      }),
      delete: jest.fn().mockImplementation(async () => {
        callOrder.push('delete');
      }),
    };
    mockCache = {
      invalidateForUser: jest.fn().mockImplementation(async () => {
        callOrder.push('invalidateForUser');
      }),
    };
    mockBudget = {
      recalculate: jest.fn().mockImplementation(async () => {
        callOrder.push('recalculate');
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        RemoveBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${RemoveBudgetLineUseCase.name}`,
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

    useCase = module.get(RemoveBudgetLineUseCase);
  });

  it('should delete, invalidate cache, then recalculate in that order', async () => {
    await useCase.execute('line-1', mockUser, undefined);

    expect(callOrder).toEqual([
      'fetchBudgetIdForLine',
      'delete',
      'invalidateForUser',
      'recalculate',
    ]);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(
      'budget-1',
      mockUser.clientKey,
    );
  });

  it('should skip recalculate when budgetId is null (genuine not-found)', async () => {
    mockRepo.fetchBudgetIdForLine.mockResolvedValueOnce(null);

    await useCase.execute('missing', mockUser, undefined);

    expect(mockRepo.delete).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should propagate fetch error without deleting', async () => {
    const fetchError = new BusinessException(
      {
        code: 'ERR_BUDGET_LINE_FETCH_FAILED',
        message: () => 'fetch failed',
        httpStatus: 500,
      },
      {},
    );
    mockRepo.fetchBudgetIdForLine.mockRejectedValueOnce(fetchError);

    await expect(
      useCase.execute('line-1', mockUser, undefined),
    ).rejects.toThrow(BusinessException);
    expect(mockRepo.delete).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should propagate delete error without invalidating cache', async () => {
    mockRepo.delete.mockRejectedValueOnce(
      new BusinessException(
        {
          code: 'ERR_BUDGET_LINE_NOT_FOUND',
          message: () => 'not found',
          httpStatus: 404,
        },
        {},
      ),
    );

    await expect(
      useCase.execute('line-1', mockUser, undefined),
    ).rejects.toThrow(BusinessException);
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should wrap recalculate failure in BUDGET_LINE_DELETE_FAILED with cause + critical severity', async () => {
    const recalcError = new Error('recalc DB error');
    mockBudget.recalculate.mockRejectedValueOnce(recalcError);

    try {
      await useCase.execute('line-1', mockUser, undefined);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe('ERR_BUDGET_LINE_DELETE_FAILED');
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.severity).toBe('critical');
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.budgetId).toBe('budget-1');
      expect(businessError.loggingContext.operation).toBe(
        'budgetLine.remove.recalcAfterDelete',
      );
    }

    // Cache was already invalidated before recalc threw — partial-failure damage control
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockRepo.delete).toHaveBeenCalledTimes(1);
  });
});
