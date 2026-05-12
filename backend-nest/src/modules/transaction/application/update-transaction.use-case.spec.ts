import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../domain/transaction.entity';
import type { TransactionUpdate } from 'pulpe-shared';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const mockEntity: Transaction = {
  id: 'txn-1',
  budgetId: 'budget-1',
  budgetLineId: null,
  amount: 50,
  name: 'Restaurant',
  kind: 'expense',
  transactionDate: '2024-01-15T12:00:00Z',
  category: null,
  checkedAt: null,
  createdAt: '2024-01-15T12:00:00Z',
  updatedAt: '2024-01-15T12:00:00Z',
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

describe('UpdateTransactionUseCase — cache invalidation ordering (R1)', () => {
  let useCase: UpdateTransactionUseCase;
  let mockRepo: { update: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { update: jest.fn().mockResolvedValue(mockEntity) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UpdateTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${UpdateTransactionUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(UpdateTransactionUseCase);
  });

  const dto: TransactionUpdate = { amount: 75 };

  it('should invalidate cache BEFORE recalc — proven by call order', async () => {
    const callOrder: string[] = [];
    mockCache.invalidateForUser.mockImplementationOnce(async () => {
      callOrder.push('invalidate');
    });
    mockBudget.recalculate.mockImplementationOnce(async () => {
      callOrder.push('recalculate');
    });

    await useCase.execute('txn-1', dto, mockUser);

    expect(callOrder).toEqual(['invalidate', 'recalculate']);
  });

  it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
    mockBudget.recalculate.mockRejectedValueOnce(new Error('DB unreachable'));

    try {
      await useCase.execute('txn-1', dto, mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_TRANSACTION_UPDATE_FAILED',
      );
    }

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should override exchange rate before calling repo.update', async () => {
    const callOrder: string[] = [];
    mockCurrency.overrideExchangeRate.mockImplementationOnce(async (d) => {
      callOrder.push('currency');
      return d;
    });
    mockRepo.update.mockImplementationOnce(async () => {
      callOrder.push('repo');
      return mockEntity;
    });

    await useCase.execute('txn-1', dto, mockUser);

    expect(callOrder).toEqual(['currency', 'repo']);
  });

  it('should build a partial patch — only updated fields reach the repo', async () => {
    const partial: TransactionUpdate = { name: 'Brunch', amount: 42 };

    await useCase.execute('txn-1', partial, mockUser);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch).toEqual({ name: 'Brunch', amount: 42 });
    expect(patch).not.toHaveProperty('kind');
    expect(patch).not.toHaveProperty('transactionDate');
  });

  it('should reject a negative amount via invariants (no repo call)', async () => {
    await expect(
      useCase.execute('txn-1', { amount: -5 }, mockUser),
    ).rejects.toThrow(BusinessException);
    expect(mockRepo.update).not.toHaveBeenCalled();
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should propagate repo.update errors without recalculation', async () => {
    const repoError = new Error('row not found');
    mockRepo.update.mockRejectedValueOnce(repoError);

    await expect(useCase.execute('txn-1', dto, mockUser)).rejects.toThrow(
      repoError,
    );
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });

  it('should return the updated entity from the repository', async () => {
    const result = await useCase.execute('txn-1', dto, mockUser);

    expect(result).toEqual(mockEntity);
    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(mockEntity.budgetId);
  });
});
