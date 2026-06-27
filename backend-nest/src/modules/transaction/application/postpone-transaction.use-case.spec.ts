import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { API_ERROR_CODES } from 'pulpe-shared';
import { PostponeTransactionUseCase } from './postpone-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PERIOD_LOOKUP_PORT } from '@modules/budget/domain/ports/budget-period-lookup.port';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../domain/transaction.entity';

const SOURCE_BUDGET_ID = 'budget-1';
const TARGET_BUDGET_ID = 'budget-2';

const eligibleTransaction: Transaction = {
  id: 'tx-1',
  budgetId: SOURCE_BUDGET_ID,
  budgetLineId: null,
  name: 'Restaurant',
  amount: 42,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  category: null,
  transactionDate: '2026-06-20T10:00:00.000Z',
  checkedAt: null,
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('PostponeTransactionUseCase', () => {
  let useCase: PostponeTransactionUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    postpone: ReturnType<typeof jest.fn>;
  };
  let mockLookup: { findNextMonthBudgetId: ReturnType<typeof jest.fn> };
  let mockRecalc: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(eligibleTransaction),
      postpone: jest
        .fn()
        .mockImplementation(
          async (
            _id: string,
            _source: string,
            targetBudgetId: string,
            shiftedDate: string,
          ) => ({
            ...eligibleTransaction,
            budgetId: targetBudgetId,
            transactionDate: shiftedDate,
          }),
        ),
    };
    mockLookup = {
      findNextMonthBudgetId: jest.fn().mockResolvedValue(TARGET_BUDGET_ID),
    };
    mockRecalc = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PostponeTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_PERIOD_LOOKUP_PORT, useValue: mockLookup },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockRecalc },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${PostponeTransactionUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(PostponeTransactionUseCase);
  });

  it('moves the transaction and shifts transaction_date by +1 month', async () => {
    const result = await useCase.execute('tx-1', mockUser);

    expect(result.sourceBudgetId).toBe(SOURCE_BUDGET_ID);
    expect(result.targetBudgetId).toBe(TARGET_BUDGET_ID);
    // June 20 -> July 20 (same instant, +1 month)
    expect(result.entity.transactionDate).toBe('2026-07-20T10:00:00.000Z');
    expect(mockRepo.postpone).toHaveBeenCalledWith(
      'tx-1',
      SOURCE_BUDGET_ID,
      TARGET_BUDGET_ID,
      '2026-07-20T10:00:00.000Z',
    );
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('clamps the shifted date at end of month (Jan 31 -> Feb 28)', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleTransaction,
      transactionDate: '2026-01-31T00:00:00.000Z',
    });

    const result = await useCase.execute('tx-1', mockUser);
    expect(result.entity.transactionDate).toBe('2026-02-28T00:00:00.000Z');
  });

  it('shifts in UTC regardless of host timezone (late-night month boundary)', async () => {
    // On a non-UTC host, date-fns addMonths would evaluate this in local time
    // and skip a month; the UTC-pinned shift keeps it deterministic.
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleTransaction,
      transactionDate: '2026-01-31T23:00:00.000Z',
    });

    const result = await useCase.execute('tx-1', mockUser);
    expect(result.entity.transactionDate).toBe('2026-02-28T23:00:00.000Z');
  });

  it('recalculates BOTH the source and target budgets', async () => {
    await useCase.execute('tx-1', mockUser);

    expect(mockRecalc.recalculate).toHaveBeenCalledTimes(2);
    expect(mockRecalc.recalculate).toHaveBeenCalledWith(SOURCE_BUDGET_ID);
    expect(mockRecalc.recalculate).toHaveBeenCalledWith(TARGET_BUDGET_ID);
  });

  it('rejects a checked transaction without mutating', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleTransaction,
      checkedAt: '2026-06-21T00:00:00.000Z',
    });

    const error = await useCase.execute('tx-1', mockUser).catch((e) => e);
    expect(error).toBeInstanceOf(BusinessException);
    expect(error.code).toBe(API_ERROR_CODES.TRANSACTION_ALREADY_CHECKED);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects an allocated transaction (budgetLineId set)', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...eligibleTransaction,
      budgetLineId: 'line-9',
    });

    const error = await useCase.execute('tx-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.TRANSACTION_ALLOCATED);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });

  it('rejects when the next-month budget does not exist', async () => {
    mockLookup.findNextMonthBudgetId.mockResolvedValueOnce(null);

    const error = await useCase.execute('tx-1', mockUser).catch((e) => e);
    expect(error.code).toBe(API_ERROR_CODES.TARGET_BUDGET_NOT_FOUND);
    expect(mockRepo.postpone).not.toHaveBeenCalled();
  });
});
