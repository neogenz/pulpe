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
    findPlannedWithdrawalRecords: ReturnType<typeof jest.fn>;
    findPlanWithdrawals: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findWithdrawals: jest.fn().mockResolvedValue([withdrawal]),
      findPlannedWithdrawalRecords: jest.fn().mockResolvedValue([
        {
          budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
          budgetId: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Apport travaux',
          month: 9,
          year: 2026,
          amount: 4_500,
        },
      ]),
      findPlanWithdrawals: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalWithdrawalsUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalWithdrawalsUseCase);
  });

  it('returns the planned withdrawal immediately, before any realization', async () => {
    mockRepo.findWithdrawals.mockResolvedValueOnce([]);

    const result = await useCase.execute('goal-1');

    expect(result).toEqual({
      withdrawals: [],
      planned: [
        {
          budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
          budgetId: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Apport travaux',
          month: 9,
          year: 2026,
          plannedAmount: 4_500,
          realizedAmount: 0,
          remainingAmount: 4_500,
          status: 'planned',
        },
      ],
      planOnly: [],
    });
    expect(mockRepo.findPlannedWithdrawalRecords).toHaveBeenCalledWith(
      'goal-1',
    );
  });

  it('exposes only plan-created linked incomes as plan_linked', async () => {
    mockRepo.findWithdrawals.mockResolvedValueOnce([]);
    mockRepo.findPlannedWithdrawalRecords.mockResolvedValueOnce([
      {
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Apport travaux',
        month: 9,
        year: 2026,
        amount: 4_500,
        origin: 'plan_linked',
      },
      {
        budgetLineId: '223e4567-e89b-12d3-a456-426614174011',
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Revenu lié ordinaire',
        month: 10,
        year: 2026,
        amount: 800,
      },
    ]);

    const result = await useCase.execute('goal-1');

    expect(result.planned[0]?.origin).toBe('plan_linked');
    expect(result.planned[1]?.origin).toBeUndefined();
  });

  it('includes direct plan withdrawals as non-actionable out-of-budget rows', async () => {
    mockRepo.findPlanWithdrawals.mockResolvedValueOnce([
      {
        id: '323e4567-e89b-12d3-a456-426614174099',
        month: 9,
        year: 2026,
        amount: 4_500,
        origin: 'plan',
      },
    ]);

    const result = await useCase.execute('goal-1');

    expect(result.planOnly).toEqual([
      {
        planWithdrawalId: '323e4567-e89b-12d3-a456-426614174099',
        name: 'Maison',
        month: 9,
        year: 2026,
        plannedAmount: 4_500,
        origin: 'plan_only',
      },
    ]);
  });

  it('derives partial and total realization from allocated Reals only', async () => {
    mockRepo.findPlannedWithdrawalRecords.mockResolvedValueOnce([
      {
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Partiel',
        month: 9,
        year: 2026,
        amount: 4_500,
      },
      {
        budgetLineId: '223e4567-e89b-12d3-a456-426614174011',
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Total',
        month: 10,
        year: 2026,
        amount: 800,
      },
    ]);
    mockRepo.findWithdrawals.mockResolvedValueOnce([
      {
        ...withdrawal,
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        amount: 1_500,
      },
      {
        ...withdrawal,
        transactionId: '123e4567-e89b-12d3-a456-426614174020',
        budgetLineId: '223e4567-e89b-12d3-a456-426614174011',
        amount: 800,
        checkedAt: null,
      },
      {
        ...withdrawal,
        transactionId: '123e4567-e89b-12d3-a456-426614174021',
        budgetLineId: null,
        amount: 200,
      },
    ]);

    const result = await useCase.execute('goal-1');

    expect(result.planned).toEqual([
      expect.objectContaining({
        name: 'Partiel',
        realizedAmount: 1_500,
        remainingAmount: 3_000,
        status: 'partially_realized',
      }),
      expect.objectContaining({
        name: 'Total',
        realizedAmount: 800,
        remainingAmount: 0,
        status: 'realized',
      }),
    ]);
    expect(result.withdrawals).toHaveLength(3);
  });

  it('normalizes floating-point residue as fully realized', async () => {
    mockRepo.findPlannedWithdrawalRecords.mockResolvedValueOnce([
      {
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Total décimal',
        month: 9,
        year: 2026,
        amount: 10.05,
      },
    ]);
    mockRepo.findWithdrawals.mockResolvedValueOnce([
      {
        ...withdrawal,
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        amount: 0.01,
      },
      {
        ...withdrawal,
        transactionId: '123e4567-e89b-12d3-a456-426614174020',
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        amount: 10.04,
      },
    ]);

    const result = await useCase.execute('goal-1');

    expect(result.planned[0]).toEqual(
      expect.objectContaining({
        remainingAmount: 0,
        status: 'realized',
      }),
    );
    expect(result.planned[0]?.realizedAmount).toBeCloseTo(10.05);
  });

  it('recomputes after an edit or deletion and ignores pointing state', async () => {
    mockRepo.findWithdrawals.mockResolvedValueOnce([
      {
        ...withdrawal,
        budgetLineId: '223e4567-e89b-12d3-a456-426614174010',
        amount: 2_000,
        checkedAt: null,
      },
    ]);

    const edited = await useCase.execute('goal-1');
    expect(edited.planned[0]).toEqual(
      expect.objectContaining({
        realizedAmount: 2_000,
        remainingAmount: 2_500,
      }),
    );

    mockRepo.findWithdrawals.mockResolvedValueOnce([]);
    const deleted = await useCase.execute('goal-1');
    expect(deleted.planned[0]).toEqual(
      expect.objectContaining({
        realizedAmount: 0,
        remainingAmount: 4_500,
      }),
    );
  });

  it('keeps the backward-compatible Real history', async () => {
    const result = await useCase.execute('goal-1');

    expect(result.withdrawals).toEqual([withdrawal]);
    expect(mockRepo.findWithdrawals).toHaveBeenCalledWith('goal-1');
  });

  it('answers NOT_FOUND rather than an empty history for a foreign goal', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('foreign')).rejects.toThrow(error);
    expect(mockRepo.findWithdrawals).not.toHaveBeenCalled();
    expect(mockRepo.findPlannedWithdrawalRecords).not.toHaveBeenCalled();
  });
});
