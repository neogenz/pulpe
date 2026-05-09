import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { ToggleTransactionCheckUseCase } from './toggle-transaction-check.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../domain/transaction.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const checkedEntity: Transaction = {
  id: 'txn-1',
  budgetId: 'budget-1',
  budgetLineId: null,
  name: 'Restaurant',
  amount: 50,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  category: null,
  transactionDate: '2024-01-15T12:00:00Z',
  checkedAt: '2024-01-16T10:00:00Z',
  createdAt: '2024-01-15T12:00:00Z',
  updatedAt: '2024-01-16T10:00:00Z',
};

describe('ToggleTransactionCheckUseCase', () => {
  let useCase: ToggleTransactionCheckUseCase;
  let mockRepo: { toggleCheck: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      toggleCheck: jest.fn().mockResolvedValue(checkedEntity),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ToggleTransactionCheckUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${ToggleTransactionCheckUseCase.name}`,
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

    useCase = module.get(ToggleTransactionCheckUseCase);
  });

  it('should delegate toggle to atomic repo RPC and return entity', async () => {
    const result = await useCase.execute('txn-1', mockUser);

    expect(result).toEqual(checkedEntity);
    expect(mockRepo.toggleCheck).toHaveBeenCalledWith('txn-1');
    expect(mockRepo.toggleCheck).toHaveBeenCalledTimes(1);
  });

  it('should invalidate user cache after toggle (details endpoint serves checkedAt)', async () => {
    await useCase.execute('txn-1', mockUser);

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
  });

  // HI-15 product decision (Option A): checkedAt is a UI / reconciliation signal.
  // It does NOT participate in ending_balance — recalc must NOT be called.
  // This use case does not inject BUDGET_RECALCULATION_PORT by design.
  // If a future contributor adds recalc here, this test catches the architectural
  // regression: the use case constructor should never receive the recalc port.
  it('should not depend on BUDGET_RECALCULATION_PORT (Option A: checkedAt is UI-only)', () => {
    const constructorParams = (
      ToggleTransactionCheckUseCase.prototype.constructor as unknown as {
        length: number;
      }
    ).length;
    // Constructor takes: repo, cacheService, logger = 3 params
    // If recalc port is added, constructor length will change to 4
    expect(constructorParams).toBe(3);
  });

  it('should propagate repo errors without invalidating cache', async () => {
    const repoError = new Error('Transaction not found or access denied');
    mockRepo.toggleCheck.mockRejectedValueOnce(repoError);

    await expect(useCase.execute('txn-1', mockUser)).rejects.toThrow(
      'Transaction not found or access denied',
    );
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });
});
