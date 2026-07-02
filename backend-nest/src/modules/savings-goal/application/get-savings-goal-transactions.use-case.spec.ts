import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { GetSavingsGoalTransactionsUseCase } from './get-savings-goal-transactions.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalLinkedTransaction,
} from '../domain/savings-goal.entity';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const goal: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Maison',
  targetAmount: 12_000,
  targetDate: '2099-12-15',
  status: 'ACTIVE',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-01-10T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

const linkedTransaction: SavingsGoalLinkedTransaction = {
  id: 'tx-1',
  budgetId: 'budget-1',
  budgetLineId: 'line-1',
  name: 'Virement épargne',
  amount: 500,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'saving',
  category: null,
  transactionDate: '2026-06-15',
  checkedAt: '2026-06-15T00:00:00Z',
  createdAt: '2026-06-15T00:00:00Z',
  updatedAt: '2026-06-15T00:00:00Z',
  budgetMonth: 6,
  budgetYear: 2026,
};

describe('GetSavingsGoalTransactionsUseCase', () => {
  let useCase: GetSavingsGoalTransactionsUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findLinkedTransactions: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findLinkedTransactions: jest.fn().mockResolvedValue([linkedTransaction]),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalTransactionsUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${GetSavingsGoalTransactionsUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalTransactionsUseCase);
  });

  it('validates the goal then returns its linked transactions', async () => {
    const result = await useCase.execute('goal-1', mockUser);

    expect(result).toEqual([linkedTransaction]);
    expect(mockRepo.findById).toHaveBeenCalledWith('goal-1');
    expect(mockRepo.findLinkedTransactions).toHaveBeenCalledWith('goal-1');
  });

  it('propagates NOT_FOUND from the repository (missing or foreign goal)', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('missing', mockUser)).rejects.toThrow(error);
    expect(mockRepo.findLinkedTransactions).not.toHaveBeenCalled();
  });
});
