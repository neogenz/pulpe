import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateBudgetLineUseCase } from './create-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { ENCRYPTION_PORT } from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from '../domain/budget-line.entity';

const mockBudgetLineRow: BudgetLineRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budget_id: '123e4567-e89b-12d3-a456-426614174001',
  template_line_id: null,
  savings_goal_id: null,
  name: 'Loyer',
  amount: 'encrypted-1200',
  kind: 'expense' as const,
  recurrence: 'fixed' as const,
  is_manually_adjusted: false,
  checked_at: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
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

describe('CreateBudgetLineUseCase', () => {
  let useCase: CreateBudgetLineUseCase;
  let mockRepo: { insert: ReturnType<typeof jest.fn> };
  let mockEncryption: {
    prepareAmountData: ReturnType<typeof jest.fn>;
    encryptOptionalAmount: ReturnType<typeof jest.fn>;
    getUserDEK: ReturnType<typeof jest.fn>;
    decryptRowAmountFields: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockSupabase: AuthenticatedSupabaseClient;

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockBudgetLineRow),
    };
    mockEncryption = {
      prepareAmountData: jest
        .fn()
        .mockResolvedValue({ amount: 'encrypted-1200' }),
      encryptOptionalAmount: jest.fn().mockResolvedValue(null),
      getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
      decryptRowAmountFields: jest.fn().mockReturnValue({
        ...mockBudgetLineRow,
        amount: 1200,
        original_amount: null,
      }),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };
    mockSupabase = {} as AuthenticatedSupabaseClient;

    const module = await Test.createTestingModule({
      providers: [
        CreateBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: ENCRYPTION_PORT, useValue: mockEncryption },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: BudgetLineMapper, useClass: BudgetLineMapper },
        {
          provide: `INFO_LOGGER:${CreateBudgetLineUseCase.name}`,
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

    useCase = module.get(CreateBudgetLineUseCase);
  });

  it('should create a budget line successfully', async () => {
    const dto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
    };

    const result = await useCase.execute(dto, mockUser, mockSupabase);

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Loyer');
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should throw when budgetId is missing', async () => {
    const dto = {
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    } as BudgetLineCreate;

    await expect(useCase.execute(dto, mockUser, mockSupabase)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should throw BUDGET_LINE_ALREADY_EXISTS on 23505 insert error', async () => {
    const dto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
    };
    mockRepo.insert.mockRejectedValueOnce(
      new BusinessException(
        {
          code: 'ERR_BUDGET_LINE_ALREADY_EXISTS',
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
