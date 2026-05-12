import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { CreateBudgetLineUseCase } from './create-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine } from '../domain/budget-line.entity';

const mockEntity: BudgetLine = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  templateLineId: null,
  savingsGoalId: null,
  name: 'Loyer',
  amount: 1200,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
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
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockEntity),
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
        CreateBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
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

    const result = await useCase.execute(dto, mockUser);

    expect(result.id).toBe(mockEntity.id);
    expect(result.name).toBe('Loyer');
    expect(result.amount).toBe(1200);
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

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
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

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
  });
});
