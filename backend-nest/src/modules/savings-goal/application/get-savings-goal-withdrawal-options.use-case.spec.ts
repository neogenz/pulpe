import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { USER_REPOSITORY } from '@modules/user/domain/ports/user-repository.port';
import type { UserSettings } from '@modules/user/domain/user.entity';
import { GetSavingsGoalWithdrawalOptionsUseCase } from './get-savings-goal-withdrawal-options.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalBalanceInputs,
} from '../domain/savings-goal.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const settings: UserSettings = {
  payDayOfMonth: null,
  currency: 'CHF',
  showCurrencySelector: false,
  locale: 'fr',
};

function makeGoal(overrides: Partial<SavingsGoal>): SavingsGoal {
  return {
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
    initialAmount: 0,
    ...overrides,
  };
}

/** Sans prévision liée, `confirmed = initialAmount − Σ retraits`. */
function makeInputs(
  overrides: Partial<SavingsGoal>,
  withdrawn = 0,
): SavingsGoalBalanceInputs {
  return {
    goal: makeGoal(overrides),
    lines: [],
    transactions: [],
    withdrawals: withdrawn ? [{ amount: withdrawn, month: 1, year: 2026 }] : [],
  };
}

describe('GetSavingsGoalWithdrawalOptionsUseCase', () => {
  let useCase: GetSavingsGoalWithdrawalOptionsUseCase;
  let mockRepo: { findAllBalanceInputs: ReturnType<typeof jest.fn> };
  let mockUserRepo: { findSettings: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { findAllBalanceInputs: jest.fn().mockResolvedValue([]) };
    mockUserRepo = { findSettings: jest.fn().mockResolvedValue(settings) };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalWithdrawalOptionsUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalWithdrawalOptionsUseCase);
  });

  it('offers each goal its confirmed balance in the account currency', async () => {
    mockRepo.findAllBalanceInputs.mockResolvedValue([
      makeInputs({ id: 'goal-1', initialAmount: 10_000 }, 4_500),
    ]);

    const options = await useCase.execute(mockUser);

    expect(options).toEqual([
      {
        goalId: 'goal-1',
        name: 'Maison',
        status: 'ACTIVE',
        availableAmount: 5_500,
        currency: 'CHF',
      },
    ]);
  });

  it('drops goals holding nothing — empty and fully withdrawn alike', async () => {
    mockRepo.findAllBalanceInputs.mockResolvedValue([
      makeInputs({ id: 'empty', initialAmount: 0 }),
      makeInputs({ id: 'drained', initialAmount: 3_000 }, 3_000),
      makeInputs({ id: 'funded', initialAmount: 100 }),
    ]);

    const options = await useCase.execute(mockUser);

    expect(options.map((option) => option.goalId)).toEqual(['funded']);
  });

  it('drops a goal whose confirmed balance rounds to zero cents', async () => {
    mockRepo.findAllBalanceInputs.mockResolvedValue([
      makeInputs({ id: 'residue', initialAmount: 0.004 }),
      makeInputs({ id: 'funded', initialAmount: 100 }),
    ]);

    const options = await useCase.execute(mockUser);

    expect(options.map((option) => option.goalId)).toEqual(['funded']);
  });

  it('keeps paused and completed goals — their money is just as real', async () => {
    mockRepo.findAllBalanceInputs.mockResolvedValue([
      makeInputs({ id: 'paused', status: 'PAUSED', initialAmount: 500 }),
      makeInputs({ id: 'completed', status: 'COMPLETED', initialAmount: 800 }),
    ]);

    const options = await useCase.execute(mockUser);

    expect(options.map((option) => option.goalId)).toEqual([
      'completed',
      'paused',
    ]);
  });

  it('sorts the richest goal first', async () => {
    mockRepo.findAllBalanceInputs.mockResolvedValue([
      makeInputs({ id: 'small', initialAmount: 200 }),
      makeInputs({ id: 'big', initialAmount: 9_000 }),
      makeInputs({ id: 'medium', initialAmount: 1_500 }),
    ]);

    const options = await useCase.execute(mockUser);

    expect(options.map((option) => option.goalId)).toEqual([
      'big',
      'medium',
      'small',
    ]);
  });
});
