import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { RemoveTransactionUseCase } from './remove-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { SAVINGS_GOAL_WITHDRAWAL_POLICY } from '@modules/savings-goal/domain/ports/savings-goal-withdrawal-policy.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('RemoveTransactionUseCase — cache invalidation ordering (R1)', () => {
  let useCase: RemoveTransactionUseCase;
  let mockRepo: {
    findMutationContext: ReturnType<typeof jest.fn>;
    delete: ReturnType<typeof jest.fn>;
    deleteWithdrawal: ReturnType<typeof jest.fn>;
  };
  let mockWithdrawalPolicy: { runAgainstBalance: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      findMutationContext: jest.fn().mockResolvedValue({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'expense',
        amount: 50,
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: null,
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteWithdrawal: jest.fn().mockResolvedValue(undefined),
    };
    mockWithdrawalPolicy = {
      runAgainstBalance: jest
        .fn()
        .mockImplementation((input) => input.write(3)),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RemoveTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: SAVINGS_GOAL_WITHDRAWAL_POLICY,
          useValue: mockWithdrawalPolicy,
        },
        {
          provide: `INFO_LOGGER:${RemoveTransactionUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(RemoveTransactionUseCase);
  });

  it('should invalidate cache BEFORE recalc — proven by call order', async () => {
    const callOrder: string[] = [];
    mockCache.invalidateForUser.mockImplementationOnce(async () => {
      callOrder.push('invalidate');
    });
    mockBudget.recalculate.mockImplementationOnce(async () => {
      callOrder.push('recalculate');
    });

    await useCase.execute('txn-1', mockUser);

    expect(callOrder).toEqual(['invalidate', 'recalculate']);
  });

  it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
    mockBudget.recalculate.mockRejectedValueOnce(new Error('DB unreachable'));

    try {
      await useCase.execute('txn-1', mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_TRANSACTION_DELETE_FAILED',
      );
    }

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should not invalidate cache when transaction has no budget_id (PGRST116 path)', async () => {
    mockRepo.findMutationContext.mockResolvedValueOnce(null);

    await useCase.execute('orphan-txn', mockUser);

    expect(mockBudget.recalculate).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  describe('savings-goal withdrawal (PUL-329)', () => {
    it('should return the stock under the revision, debiting nothing', async () => {
      mockRepo.findMutationContext.mockResolvedValueOnce({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'income',
        amount: 3500,
        sourceSavingsGoalId: 'goal-1',
        sourceSavingsGoalName: 'Maison',
      });

      await useCase.execute('txn-1', mockUser);

      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.goalId).toBe('goal-1');
      expect(input.debit).toBe(0);
      expect(mockRepo.deleteWithdrawal).toHaveBeenCalledWith('txn-1', 3);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should delete a broken link the ordinary way — no balance left to defend', async () => {
      mockRepo.findMutationContext.mockResolvedValueOnce({
        budgetId: 'budget-1',
        budgetLineId: null,
        kind: 'income',
        amount: 3500,
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: 'Maison',
      });

      await useCase.execute('txn-1', mockUser);

      expect(mockWithdrawalPolicy.runAgainstBalance).not.toHaveBeenCalled();
      expect(mockRepo.delete).toHaveBeenCalledWith('txn-1');
    });
  });
});
