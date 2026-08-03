import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { SAVINGS_GOAL_WITHDRAWAL_POLICY } from '@modules/savings-goal/domain/ports/savings-goal-withdrawal-policy.port';
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
  tagIds: [],
  checkedAt: null,
  createdAt: '2024-01-15T12:00:00Z',
  updatedAt: '2024-01-15T12:00:00Z',
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  sourceSavingsGoalId: null,
  sourceSavingsGoalName: null,
};

describe('UpdateTransactionUseCase — cache invalidation ordering (R1)', () => {
  let useCase: UpdateTransactionUseCase;
  let mockRepo: {
    update: ReturnType<typeof jest.fn>;
    updateWithdrawal: ReturnType<typeof jest.fn>;
    findMutationContext: ReturnType<typeof jest.fn>;
  };
  let mockWithdrawalPolicy: { runAgainstBalance: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      update: jest.fn().mockResolvedValue(mockEntity),
      updateWithdrawal: jest.fn().mockResolvedValue(mockEntity),
      findMutationContext: jest.fn().mockResolvedValue({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'expense',
        amount: 50,
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: null,
      }),
    };
    mockWithdrawalPolicy = {
      runAgainstBalance: jest
        .fn()
        .mockImplementation((input) => input.write(7)),
    };
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
          provide: SAVINGS_GOAL_WITHDRAWAL_POLICY,
          useValue: mockWithdrawalPolicy,
        },
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

  describe('savings-goal withdrawal (PUL-329)', () => {
    const goalId = 'goal-1';

    const asActiveWithdrawal = (amount: number): void => {
      mockRepo.findMutationContext.mockResolvedValue({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'income',
        amount,
        sourceSavingsGoalId: goalId,
        sourceSavingsGoalName: 'Maison',
      });
    };

    it('should give the previous amount back before arbitrating the new one', async () => {
      asActiveWithdrawal(4500);

      await useCase.execute('txn-1', { amount: 3500 }, mockUser);

      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.goalId).toBe(goalId);
      expect(input.debit).toBe(3500);
      expect(input.creditBack).toBe(4500);
      expect(mockRepo.updateWithdrawal).toHaveBeenCalledWith(
        'txn-1',
        { amount: 3500 },
        7,
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should keep an amount-less edit under the revision, stock unchanged', async () => {
      asActiveWithdrawal(4500);

      await useCase.execute('txn-1', { name: 'Apport cuisine' }, mockUser);

      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.debit).toBe(4500);
      expect(input.creditBack).toBe(4500);
    });

    it('should refuse to change the kind of a goal-sourced income', async () => {
      asActiveWithdrawal(4500);

      const caught = await useCase
        .execute('txn-1', { kind: 'expense' }, mockUser)
        .catch((error: unknown) => error);

      expect((caught as BusinessException).code).toBe(
        'ERR_SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID',
      );
      expect(mockWithdrawalPolicy.runAgainstBalance).not.toHaveBeenCalled();
      expect(mockRepo.updateWithdrawal).not.toHaveBeenCalled();
    });

    it('should edit a broken link freely, with no balance to check', async () => {
      mockRepo.findMutationContext.mockResolvedValue({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'income',
        amount: 4500,
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: 'Maison',
      });

      await useCase.execute('txn-1', { amount: 3500 }, mockUser);

      expect(mockWithdrawalPolicy.runAgainstBalance).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should still forbid a kind change on a broken link', async () => {
      mockRepo.findMutationContext.mockResolvedValue({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'income',
        amount: 4500,
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: 'Maison',
      });

      await expect(
        useCase.execute('txn-1', { kind: 'saving' }, mockUser),
      ).rejects.toThrow(BusinessException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });
});
