import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../domain/transaction.entity';

const mockTransactionEntity: Transaction = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
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

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let mockRepo: {
    insert: ReturnType<typeof jest.fn>;
    fetchBudgetLineForAllocation: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockTransactionEntity),
      fetchBudgetLineForAllocation: jest.fn().mockResolvedValue(null),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${CreateTransactionUseCase.name}`,
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

    useCase = module.get(CreateTransactionUseCase);
  });

  it('should create a transaction successfully', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };

    const result = await useCase.execute(dto, mockUser);

    expect(result.name).toBe('Restaurant');
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should throw when budgetId is missing', async () => {
    const dto = {
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
    } as TransactionCreate;

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should throw when amount is zero', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 0,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should validate budget line allocation when budgetLineId is provided', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      budgetLineId: 'line-1',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce({
      id: 'line-1',
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      kind: 'expense',
    });

    const result = await useCase.execute(dto, mockUser);

    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(mockRepo.fetchBudgetLineForAllocation).toHaveBeenCalledWith(
      'line-1',
    );
  });

  it('should throw when budget line budget does not match', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      budgetLineId: 'line-1',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce({
      id: 'line-1',
      budgetId: 'different-budget',
      kind: 'expense',
    });

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
  });

  it('should throw TRANSACTION_ALREADY_EXISTS on duplicate id', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.insert.mockRejectedValueOnce(
      new BusinessException(
        {
          code: 'ERR_TRANSACTION_ALREADY_EXISTS',
          message: () => 'exists',
          httpStatus: 409,
        },
        {},
      ),
    );

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
  });

  describe('cache invalidation ordering (R1)', () => {
    it('should invalidate cache BEFORE recalc — proven by call order', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15T12:00:00Z',
      };
      const callOrder: string[] = [];
      mockCache.invalidateForUser.mockImplementationOnce(async () => {
        callOrder.push('invalidate');
      });
      mockBudget.recalculate.mockImplementationOnce(async () => {
        callOrder.push('recalculate');
      });

      await useCase.execute(dto, mockUser);

      expect(callOrder).toEqual(['invalidate', 'recalculate']);
    });

    it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15T12:00:00Z',
      };
      mockBudget.recalculate.mockRejectedValueOnce(new Error('DB unreachable'));

      try {
        await useCase.execute(dto, mockUser);
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TRANSACTION_CREATE_FAILED',
        );
      }

      expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
