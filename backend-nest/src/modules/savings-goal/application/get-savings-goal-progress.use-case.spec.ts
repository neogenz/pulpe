import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { GetSavingsGoalProgressUseCase } from './get-savings-goal-progress.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoal } from '../domain/savings-goal.entity';
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

describe('GetSavingsGoalProgressUseCase', () => {
  let useCase: GetSavingsGoalProgressUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findLinkedContributions: ReturnType<typeof jest.fn>;
    findPayDayOfMonth: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValue({ lines: [], transactions: [] }),
      findPayDayOfMonth: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalProgressUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${GetSavingsGoalProgressUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalProgressUseCase);
  });

  it('computes the two layers from the decrypted linked contributions', async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines: [
        {
          id: 'line-1',
          amount: 500,
          kind: 'saving',
          checkedAt: '2026-06-01T00:00:00Z',
          month: currentMonth,
          year: currentYear,
        },
      ],
      transactions: [],
    });

    const { goal: returnedGoal, computed } = await useCase.execute(
      'goal-1',
      mockUser,
    );

    expect(returnedGoal).toEqual(goal);
    expect(computed.plannedCumulative).toBe(500);
    expect(computed.confirmed).toBe(500); // ligne pointée → enveloppe
    expect(computed.linkedLineCount).toBe(1);
    expect(mockRepo.findLinkedContributions).toHaveBeenCalledWith('goal-1');
  });

  it('is payDay-aware: forwards the user payDayOfMonth to the formulas', async () => {
    // Ancrage attendu recalculé via le même helper payDay-aware que la prod —
    // déterministe quel que soit le jour où la suite tourne.
    const { getBudgetPeriodForDate } = await import('pulpe-shared');
    const payDay = 25;
    const now = new Date();
    const created = new Date(now.getFullYear(), now.getMonth() - 3, 28);
    mockRepo.findById.mockResolvedValue({
      ...goal,
      createdAt: created.toISOString(),
    });
    mockRepo.findPayDayOfMonth.mockResolvedValue(payDay);

    const { computed } = await useCase.execute('goal-1', mockUser);

    const index = (p: { month: number; year: number }) => p.year * 12 + p.month;
    const expectedElapsed = Math.max(
      1,
      index(getBudgetPeriodForDate(now, payDay)) -
        index(getBudgetPeriodForDate(created, payDay)) +
        1,
    );
    expect(mockRepo.findPayDayOfMonth).toHaveBeenCalled();
    expect(computed.monthsElapsed).toBe(expectedElapsed);
  });

  it('propagates NOT_FOUND from the repository (missing or foreign goal)', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('missing', mockUser)).rejects.toThrow(error);
    expect(mockRepo.findLinkedContributions).not.toHaveBeenCalled();
  });
});
