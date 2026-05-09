import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { RemoveTransactionUseCase } from './remove-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
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

describe('RemoveTransactionUseCase — cache invalidation ordering (R1)', () => {
  let useCase: RemoveTransactionUseCase;
  let mockRepo: {
    fetchBudgetIdForTransaction: ReturnType<typeof jest.fn>;
    delete: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      fetchBudgetIdForTransaction: jest.fn().mockResolvedValue('budget-1'),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RemoveTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${RemoveTransactionUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(RemoveTransactionUseCase);
  });

  it('should invalidate cache BEFORE recalc — proven by call order', async () => {
    const callOrder: string[] = [];
    mockCache.invalidateForUser.mockImplementationOnce(async () => {
      callOrder.push('invalidate');
    });
    mockBudget.recalculate.mockImplementationOnce(async () => {
      callOrder.push('recalculate');
    });

    await useCase.execute('txn-1', mockUser);

    expect(callOrder).toEqual(['invalidate', 'recalculate']);
  });

  it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
    mockBudget.recalculate.mockRejectedValueOnce(new Error('DB unreachable'));

    try {
      await useCase.execute('txn-1', mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_TRANSACTION_DELETE_FAILED',
      );
    }

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should not invalidate cache when transaction has no budget_id (PGRST116 path)', async () => {
    mockRepo.fetchBudgetIdForTransaction.mockResolvedValueOnce(null);

    await useCase.execute('orphan-txn', mockUser);

    expect(mockBudget.recalculate).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
