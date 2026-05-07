import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BudgetService } from '@modules/budget/budget.service';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { TransactionRow } from '../domain/transaction.entity';

const mockTransactionRow: TransactionRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budget_id: '123e4567-e89b-12d3-a456-426614174001',
  budget_line_id: null,
  amount: 'encrypted-50',
  name: 'Restaurant',
  kind: 'expense' as const,
  transaction_date: '2024-01-15T12:00:00Z',
  category: null,
  checked_at: null,
  created_at: '2024-01-15T12:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
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
  let mockEncryption: {
    prepareAmountData: ReturnType<typeof jest.fn>;
    encryptOptionalAmount: ReturnType<typeof jest.fn>;
    getUserDEK: ReturnType<typeof jest.fn>;
    decryptRowAmountFields: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculateBalances: ReturnType<typeof jest.fn> };
  let mockSupabase: AuthenticatedSupabaseClient;

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockTransactionRow),
      fetchBudgetLineForAllocation: jest.fn().mockResolvedValue(null),
    };
    mockEncryption = {
      prepareAmountData: jest
        .fn()
        .mockResolvedValue({ amount: 'encrypted-50' }),
      encryptOptionalAmount: jest.fn().mockResolvedValue(null),
      getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
      decryptRowAmountFields: jest.fn().mockReturnValue({
        ...mockTransactionRow,
        amount: 50,
        original_amount: null,
      }),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = {
      recalculateBalances: jest.fn().mockResolvedValue(undefined),
    };
    mockSupabase = {} as AuthenticatedSupabaseClient;

    const module = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BudgetService, useValue: mockBudget },
        { provide: TransactionMapper, useClass: TransactionMapper },
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

    const result = await useCase.execute(dto, mockUser, mockSupabase);

    expect(result.success).toBe(true);
    const data = result.data;
    expect(data && !Array.isArray(data) ? data.name : null).toBe('Restaurant');
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculateBalances).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should throw when budgetId is missing', async () => {
    const dto = {
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
    } as TransactionCreate;

    await expect(useCase.execute(dto, mockUser, mockSupabase)).rejects.toThrow(
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

    await expect(useCase.execute(dto, mockUser, mockSupabase)).rejects.toThrow(
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
      budget_id: '123e4567-e89b-12d3-a456-426614174001',
      kind: 'expense',
    });

    const result = await useCase.execute(dto, mockUser, mockSupabase);

    expect(result.success).toBe(true);
    expect(mockRepo.fetchBudgetLineForAllocation).toHaveBeenCalledWith(
      'line-1',
      mockSupabase,
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
      budget_id: 'different-budget',
      kind: 'expense',
    });

    await expect(useCase.execute(dto, mockUser, mockSupabase)).rejects.toThrow(
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

    await expect(useCase.execute(dto, mockUser, mockSupabase)).rejects.toThrow(
      BusinessException,
    );
  });
});
