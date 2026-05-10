import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
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
});
