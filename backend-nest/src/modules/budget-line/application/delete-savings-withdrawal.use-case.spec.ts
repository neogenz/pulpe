import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { DeleteSavingsWithdrawalUseCase } from './delete-savings-withdrawal.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const GROUP_ID = 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const makeLine = (
  overrides: Partial<BudgetLine> & Pick<BudgetLine, 'id' | 'budgetId' | 'kind'>,
): BudgetLine => ({
  templateLineId: null,
  savingsGoalId: null,
  spreadGroupId: null,
  savingsWithdrawalGroupId: GROUP_ID,
  name: 'Mon épargne',
  amount: 280,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  recurrence: 'one_off',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const incomeLine = makeLine({
  id: 'line-income',
  budgetId: 'budget-july',
  kind: 'income',
});
const savingLine = makeLine({
  id: 'line-saving',
  budgetId: 'budget-august',
  kind: 'saving',
});

describe('DeleteSavingsWithdrawalUseCase', () => {
  let useCase: DeleteSavingsWithdrawalUseCase;
  let mockRepo: {
    findBySavingsWithdrawalGroupId: ReturnType<typeof jest.fn>;
    deleteSavingsWithdrawalGroup: ReturnType<typeof jest.fn>;
  };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      findBySavingsWithdrawalGroupId: jest
        .fn()
        .mockResolvedValue([incomeLine, savingLine]),
      deleteSavingsWithdrawalGroup: jest.fn().mockResolvedValue(undefined),
    };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        DeleteSavingsWithdrawalUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${DeleteSavingsWithdrawalUseCase.name}`,
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

    useCase = module.get(DeleteSavingsWithdrawalUseCase);
  });

  it('should delete both lines and recalculate both budgets for scope pair', async () => {
    await useCase.execute(GROUP_ID, 'pair', mockUser);

    expect(mockRepo.deleteSavingsWithdrawalGroup).toHaveBeenCalledWith(
      GROUP_ID,
      'pair',
    );
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(2);
    expect(mockBudget.recalculate).toHaveBeenCalledWith('budget-july');
    expect(mockBudget.recalculate).toHaveBeenCalledWith('budget-august');
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should delete only the saving and recalculate only its budget for scope repayment', async () => {
    await useCase.execute(GROUP_ID, 'repayment', mockUser);

    expect(mockRepo.deleteSavingsWithdrawalGroup).toHaveBeenCalledWith(
      GROUP_ID,
      'repayment',
    );
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledWith('budget-august');
  });

  it('should throw 404 without deleting when the group is unknown or not owned', async () => {
    mockRepo.findBySavingsWithdrawalGroupId.mockResolvedValue([]);

    try {
      await useCase.execute(GROUP_ID, 'pair', mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_SAVINGS_WITHDRAWAL_GROUP_NOT_FOUND',
      );
    }
    expect(mockRepo.deleteSavingsWithdrawalGroup).not.toHaveBeenCalled();
  });

  it('should succeed idempotently for scope repayment when the saving is already gone', async () => {
    mockRepo.findBySavingsWithdrawalGroupId.mockResolvedValue([incomeLine]);

    await useCase.execute(GROUP_ID, 'repayment', mockUser);

    expect(mockRepo.deleteSavingsWithdrawalGroup).toHaveBeenCalledWith(
      GROUP_ID,
      'repayment',
    );
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should expose a partial failure when recalculation fails after the delete committed', async () => {
    mockBudget.recalculate.mockRejectedValue(new Error('recalc boom'));

    try {
      await useCase.execute(GROUP_ID, 'pair', mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_SAVINGS_WITHDRAWAL_RECALCULATION_FAILED',
      );
      expect(businessError.loggingContext.partialFailure).toBe(true);
    }
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
