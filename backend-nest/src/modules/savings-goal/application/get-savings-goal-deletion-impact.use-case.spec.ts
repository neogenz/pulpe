import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { GetSavingsGoalDeletionImpactUseCase } from './get-savings-goal-deletion-impact.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalDeletionImpactResult,
} from '../domain/savings-goal.entity';

const user = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
} satisfies AuthenticatedUser;

const goal = { id: 'goal-1' } as SavingsGoal;
const impact = {
  goalId: 'goal-1',
  summary: {
    templateLineCount: 0,
    templateLineTotal: 0,
    budgetCount: 0,
    budgetLineCount: 0,
    budgetLineTotal: 0,
    transactionCount: 0,
    transactionTotal: 0,
    withdrawalCount: 0,
    withdrawalTotal: 0,
  },
  templateLines: [],
  budgets: [],
  withdrawals: [],
  revision: { templateLines: [], budgetLines: [], transactions: [] },
} satisfies SavingsGoalDeletionImpactResult;

describe('GetSavingsGoalDeletionImpactUseCase', () => {
  let useCase: GetSavingsGoalDeletionImpactUseCase;
  let repo: {
    findById: ReturnType<typeof jest.fn>;
    getDeletionImpact: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    repo = {
      findById: jest.fn().mockResolvedValue(goal),
      getDeletionImpact: jest.fn().mockResolvedValue(impact),
    };
    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalDeletionImpactUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        {
          provide: `INFO_LOGGER:${GetSavingsGoalDeletionImpactUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();
    useCase = module.get(GetSavingsGoalDeletionImpactUseCase);
  });

  it('validates ownership before returning the fresh impact', async () => {
    await expect(useCase.execute('goal-1', user)).resolves.toBe(impact);
    expect(repo.findById).toHaveBeenCalledWith('goal-1');
    expect(repo.getDeletionImpact).toHaveBeenCalledWith('goal-1');
  });

  it('does not query impact when ownership validation fails', async () => {
    const error = new Error('not found');
    repo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('goal-1', user)).rejects.toBe(error);
    expect(repo.getDeletionImpact).not.toHaveBeenCalled();
  });
});
