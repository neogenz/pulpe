import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { API_ERROR_CODES } from 'pulpe-shared';
import { PostponeBudgetLineUseCase } from './postpone-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PERIOD_LOOKUP_PORT } from '@modules/budget/domain/ports/budget-period-lookup.port';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine } from '../domain/budget-line.entity';

const SOURCE_BUDGET_ID = 'budget-1';
const TARGET_BUDGET_ID = 'budget-2';

const eligibleLine: BudgetLine = {
  id: 'line-1',
  budgetId: SOURCE_BUDGET_ID,
  templateLineId: 'tpl-1',
  savingsGoalId: null,
  spreadGroupId: null,
  name: 'Cadeau anniversaire',
  amount: 80,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'one_off',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const postponedLine: BudgetLine = {
  ...eligibleLine,
  budgetId: TARGET_BUDGET_ID,
  templateLineId: null,
  isManuallyAdjusted: true,
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('PostponeBudgetLineUseCase', () => {
  let useCase: PostponeBudgetLineUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    hasAllocatedTransactions: ReturnType<typeof jest.fn>;
    postpone: ReturnType<typeof jest.fn>;
  };
  let mockLookup: { findNextMonthBudgetId: ReturnType<typeof jest.fn> };
  let mockRecalc: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(eligibleLine),
      hasAllocatedTransactions: jest.fn().mockResolvedValue(false),
      postpone: jest.fn().mockResolvedValue(postponedLine),
    };
    mockLookup = {
      findNextMonthBudgetId: jest.fn().mockResolvedValue(TARGET_BUDGET_ID),
    };
    mockRecalc = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PostponeBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_PERIOD_LOOKUP_PORT, useValue: mockLookup },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockRecalc },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${PostponeBudgetLineUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(PostponeBudgetLineUseCase);
  });

  it('moves an eligible line and returns both impacted budget ids', async () => {
    const result = await useCase.execute('line-1', mockUser);

    expect(result).toEqual({
      entity: postponedLine,
      sourceBudgetId: SOURCE_BUDGET_ID,
      targetBudgetId: TARGET_BUDGET_ID,
    });
    expect(mockRepo.postpone).toHaveBeenCalledWith(
      'line-1',
      SOURCE_BUDGET_ID,
      TARGET_BUDGET_ID,
    );
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('recalculates BOTH the source and target budgets', async () => {
    await useCase.execute('line-1', mockUser);

    expect(mockRecalc.recalculate).toHaveBeenCalledTimes(2);
    expect(mockRecalc.recalculate).toHaveBeenCalledWith(SOURCE_BUDGET_ID);
    expect(mockRecalc.recalculate).toHaveBeenCalledWith(TARGET_BUDGET_ID);
  });

  it('rejects a checked line without mutating', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleLine,
      checkedAt: '2026-06-10T00:00:00.000Z',
    });

    const error = await useCase.execute('line-1', mockUser).catch((e) => e);
    expect(error).toBeInstanceOf(BusinessException);
    expect(error.code).toBe(API_ERROR_CODES.BUDGET_LINE_ALREADY_CHECKED);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects a recurring (fixed) line', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleLine,
      recurrence: 'fixed',
    });

    const error = await useCase.execute('line-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.BUDGET_LINE_NOT_POSTPONABLE);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects a spread occurrence (carries a spreadGroupId)', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleLine,
      spreadGroupId: 'grp-1',
    });

    const error = await useCase.execute('line-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.BUDGET_LINE_NOT_POSTPONABLE);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects a line carrying allocated transactions', async () => {
    mockRepo.hasAllocatedTransactions.mockResolvedValueOnce(true);

    const error = await useCase.execute('line-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.BUDGET_LINE_HAS_TRANSACTIONS);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects when the next-month budget does not exist', async () => {
    mockLookup.findNextMonthBudgetId.mockResolvedValueOnce(null);

    const error = await useCase.execute('line-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.TARGET_BUDGET_NOT_FOUND);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });
});
