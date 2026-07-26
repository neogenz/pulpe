import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { UpdateSavingsGoalUseCase } from './update-savings-goal.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const goal = {
  id: 'goal-1',
  userId: user.id,
  name: 'Maison',
  startDate: null,
  targetAmount: 100_000,
  targetDate: '2030-05-15',
  status: 'ACTIVE' as const,
  initialAmount: null,
  createdAt: '2026-07-16T08:00:00Z',
  updatedAt: '2026-07-16T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

describe('UpdateSavingsGoalUseCase — initialAmount patch semantics (PUL-293)', () => {
  let useCase: UpdateSavingsGoalUseCase;
  let repo: {
    findById: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    repo = {
      findById: jest.fn().mockResolvedValue(goal),
      update: jest.fn().mockResolvedValue(goal),
    };

    const module = await Test.createTestingModule({
      providers: [
        UpdateSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        {
          provide: `INFO_LOGGER:${UpdateSavingsGoalUseCase.name}`,
          useValue: { info: jest.fn() },
        },
      ],
    }).compile();
    useCase = module.get(UpdateSavingsGoalUseCase);
  });

  it('should carry an explicit 0 through — clearing the initial amount is a change, not an omission', async () => {
    // The load-bearing guard is `!== undefined`: a truthiness check would drop
    // 0 and the erase would fail silently, leaving the old ciphertext in place.
    await useCase.execute('goal-1', { initialAmount: 0 }, user);

    expect(repo.update).toHaveBeenCalledWith('goal-1', { initialAmount: 0 });
  });

  it('should leave the column alone when initialAmount is omitted', async () => {
    await useCase.execute('goal-1', { status: 'PAUSED' }, user);

    const patch = repo.update.mock.calls[0][1];
    expect('initialAmount' in patch).toBe(false);
    expect(patch).toEqual({ status: 'PAUSED' });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('should forward a positive initial amount', async () => {
    await useCase.execute('goal-1', { initialAmount: 5000 }, user);

    expect(repo.update).toHaveBeenCalledWith('goal-1', { initialAmount: 5000 });
  });

  it('forwards explicit nulls while preserving omitted interval fields', async () => {
    await useCase.execute(
      'goal-1',
      { startDate: null, targetAmount: null, targetDate: null },
      user,
    );

    expect(repo.update).toHaveBeenCalledWith('goal-1', {
      startDate: null,
      targetAmount: null,
      targetDate: null,
    });
  });

  it('rejects a partial patch whose merged interval starts after its deadline', async () => {
    repo.findById.mockResolvedValue({
      ...goal,
      startDate: '2030-01-01',
      targetDate: '2030-05-15',
    });

    await expect(
      useCase.execute('goal-1', { startDate: '2030-06-01' }, user),
    ).rejects.toMatchObject({ code: 'ERR_BUSINESS_RULE_VIOLATION' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
