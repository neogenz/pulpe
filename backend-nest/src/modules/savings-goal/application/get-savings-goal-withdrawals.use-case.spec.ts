import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { GetSavingsGoalWithdrawalsUseCase } from './get-savings-goal-withdrawals.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalWithdrawalRecord,
} from '../domain/savings-goal.entity';

const goal: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Maison',
  startDate: null,
  targetAmount: 20_000,
  targetDate: '2099-12-15',
  status: 'ACTIVE',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-01-10T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: null,
};

const withdrawal: SavingsGoalWithdrawalRecord = {
  transactionId: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Apport travaux',
  transactionDate: '2026-07-15T10:00:00Z',
  amount: 4_500,
};

describe('GetSavingsGoalWithdrawalsUseCase', () => {
  let useCase: GetSavingsGoalWithdrawalsUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findWithdrawals: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findWithdrawals: jest.fn().mockResolvedValue([withdrawal]),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalWithdrawalsUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalWithdrawalsUseCase);
  });

  it('returns the history of an owned goal', async () => {
    const result = await useCase.execute('goal-1');

    expect(result).toEqual([withdrawal]);
    expect(mockRepo.findWithdrawals).toHaveBeenCalledWith('goal-1');
  });

  it('answers NOT_FOUND rather than an empty history for a foreign goal', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('foreign')).rejects.toThrow(error);
    expect(mockRepo.findWithdrawals).not.toHaveBeenCalled();
  });
});
