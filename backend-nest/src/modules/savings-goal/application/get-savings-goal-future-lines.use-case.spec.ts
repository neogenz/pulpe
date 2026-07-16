import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { GetSavingsGoalFutureLinesUseCase } from './get-savings-goal-future-lines.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

function periodFromIndex(index: number): { month: number; year: number } {
  const year = Math.floor((index - 1) / 12);
  return { month: index - year * 12, year };
}

describe('GetSavingsGoalFutureLinesUseCase (PUL-285 CA5/CA9)', () => {
  let useCase: GetSavingsGoalFutureLinesUseCase;
  let repo: Record<string, ReturnType<typeof jest.fn>>;
  let currentIndex: number;

  const line = (
    offsetFromCurrent: number,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: `line-${offsetFromCurrent}-${JSON.stringify(overrides)}`,
    amount: 100,
    kind: 'saving' as const,
    checkedAt: null,
    isManuallyAdjusted: false,
    ...periodFromIndex(currentIndex + offsetFromCurrent),
    ...overrides,
  });

  beforeEach(async () => {
    const now = new Date();
    currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
    repo = {
      findById: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      findPayDayOfMonth: jest.fn().mockResolvedValue(null),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValue({ lines: [], transactions: [] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalFutureLinesUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
      ],
    }).compile();
    useCase = module.get(GetSavingsGoalFutureLinesUseCase);
  });

  it('should keep only unchecked, non-adjusted lines of the current cycle and beyond, sorted by period', async () => {
    const past = line(-1);
    const checked = line(1, { checkedAt: '2026-07-01T00:00:00Z' });
    const adjusted = line(2, { isManuallyAdjusted: true });
    const current = line(0);
    const future = line(3);
    repo.findLinkedContributions.mockResolvedValue({
      lines: [future, past, checked, adjusted, current],
      transactions: [],
    });

    const result = await useCase.execute('goal-1', user);

    expect(result.map((item) => item.id)).toEqual([current.id, future.id]);
  });

  it('should include lines generated beyond the goal target date (no deadline bound)', async () => {
    const farFuture = line(60);
    repo.findLinkedContributions.mockResolvedValue({
      lines: [farFuture],
      transactions: [],
    });

    const result = await useCase.execute('goal-1', user);

    expect(result).toEqual([farFuture]);
  });
});
