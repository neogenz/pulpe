import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { GetSavingsGoalContributionsUseCase } from './get-savings-goal-contributions.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalContribution,
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

const contribution: SavingsGoalContribution = {
  lineId: 'line-1',
  name: 'Épargne mensuelle',
  amount: 500,
  checkedAt: null,
  budgetMonth: 6,
  budgetYear: 2026,
  transactions: [],
};

describe('GetSavingsGoalContributionsUseCase', () => {
  let useCase: GetSavingsGoalContributionsUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findContributions: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findContributions: jest.fn().mockResolvedValue([contribution]),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalContributionsUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${GetSavingsGoalContributionsUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalContributionsUseCase);
  });

  it('validates the goal then returns its contributions', async () => {
    const result = await useCase.execute('goal-1', mockUser);

    expect(result).toEqual([contribution]);
    expect(mockRepo.findById).toHaveBeenCalledWith('goal-1');
    expect(mockRepo.findContributions).toHaveBeenCalledWith('goal-1');
  });

  it('propagates NOT_FOUND from the repository (missing or foreign goal)', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('missing', mockUser)).rejects.toThrow(error);
    expect(mockRepo.findContributions).not.toHaveBeenCalled();
  });
});
