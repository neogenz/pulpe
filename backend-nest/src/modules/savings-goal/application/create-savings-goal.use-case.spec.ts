import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import {
  getBudgetPeriodForDate,
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
} from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { BUDGET_LINE_SPREAD_PORT } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { CreateSavingsGoalUseCase } from './create-savings-goal.use-case';

const GOAL_ID = 'b3f1c0de-0000-4000-8000-000000000001';

const periodAtOffset = (
  offset: number,
  payDayOfMonth: number | null = null,
): BudgetPeriod =>
  periodFromIndex(
    periodIndex(getBudgetPeriodForDate(new Date(), payDayOfMonth)) + offset,
  );

/** Day 15 lands in its own calendar month whatever the pay day (1, ≤15 or >15). */
const dayOfPeriod = (period: BudgetPeriod, day: number): string =>
  `${period.year}-${String(period.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const userWithPayDay = (payDayOfMonth: number | null): AuthenticatedUser => ({
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
  payDayOfMonth,
});

const user = userWithPayDay(null);

const goalWithTargetDate = (targetDate: string) => ({
  id: GOAL_ID,
  userId: user.id,
  name: 'Canapé',
  targetAmount: 3700,
  targetDate,
  status: 'ACTIVE' as const,
  createdAt: '2026-07-16T08:00:00Z',
  updatedAt: '2026-07-16T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: null,
});

describe('CreateSavingsGoalUseCase — bounded materialization (PUL-316)', () => {
  let useCase: CreateSavingsGoalUseCase;
  let repo: {
    insert: ReturnType<typeof jest.fn>;
    findMaterializedPeriods: ReturnType<typeof jest.fn>;
  };
  let spread: { fanOut: ReturnType<typeof jest.fn> };
  let logger: {
    info: ReturnType<typeof jest.fn>;
    warn: ReturnType<typeof jest.fn>;
  };

  const buildUseCase = async (): Promise<void> => {
    const module = await Test.createTestingModule({
      providers: [
        CreateSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        { provide: BUDGET_LINE_SPREAD_PORT, useValue: spread },
        {
          provide: `INFO_LOGGER:${CreateSavingsGoalUseCase.name}`,
          useValue: logger,
        },
      ],
    }).compile();
    useCase = module.get(CreateSavingsGoalUseCase);
  };

  const createGoal = async (
    targetDate: string,
    monthlyContribution: number | undefined,
    authenticatedUser: AuthenticatedUser = user,
  ) => {
    repo.insert.mockResolvedValue(goalWithTargetDate(targetDate));
    return useCase.execute(
      {
        name: 'Canapé',
        targetAmount: 3700,
        targetDate,
        status: 'ACTIVE',
        ...(monthlyContribution != null ? { monthlyContribution } : {}),
      },
      authenticatedUser,
    );
  };

  const trancheePeriods = (): BudgetPeriod[] =>
    spread.fanOut.mock.calls[0][0].tranches.map(
      ({ month, year }: BudgetPeriod) => ({ month, year }),
    );

  beforeEach(async () => {
    repo = {
      insert: jest.fn(),
      findMaterializedPeriods: jest
        .fn()
        .mockResolvedValue(
          [-2, -1, 0, 1, 2, 3, 4, 5].map((offset) => periodAtOffset(offset)),
        ),
    };
    spread = {
      fanOut: jest.fn().mockResolvedValue({
        spreadGroupId: GOAL_ID,
        lines: [{ id: 'line-1' }],
        createdBudgets: [],
        skippedMonths: [],
      }),
    };
    logger = { info: jest.fn(), warn: jest.fn() };
    await buildUseCase();
  });

  it('should materialize one forecast per budgeted month up to the target period', async () => {
    await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    expect(trancheePeriods()).toEqual([
      periodAtOffset(0),
      periodAtOffset(1),
      periodAtOffset(2),
    ]);
  });

  it('should carry the monthly contribution on every materialized month', async () => {
    await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    const [input] = spread.fanOut.mock.calls[0];
    expect(input.tranches.map((t: { amount: number }) => t.amount)).toEqual([
      692.5, 692.5, 692.5,
    ]);
    expect(input.kind).toBe('saving');
    expect(input.savingsGoalId).toBe(GOAL_ID);
    expect(input.name).toBe('Canapé');
  });

  it('should exclude the period after the target date', async () => {
    await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    expect(trancheePeriods()).not.toContainEqual(periodAtOffset(3));
  });

  it('should exclude periods before the current one', async () => {
    await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    expect(trancheePeriods()).not.toContainEqual(periodAtOffset(-1));
  });

  it('should never materialize a month that has no budget yet', async () => {
    repo.findMaterializedPeriods.mockResolvedValue([
      periodAtOffset(0),
      periodAtOffset(2),
    ]);

    await createGoal(dayOfPeriod(periodAtOffset(3), 15), 692.5);

    expect(trancheePeriods()).toEqual([periodAtOffset(0), periodAtOffset(2)]);
  });

  it('should use the goal id as the spread idempotency key', async () => {
    await createGoal(dayOfPeriod(periodAtOffset(1), 15), 692.5);

    expect(spread.fanOut.mock.calls[0][0].spreadGroupId).toBe(GOAL_ID);
  });

  it('should bound the horizon on the pay-day cycle, not the calendar', async () => {
    const payDayUser = userWithPayDay(27);
    repo.findMaterializedPeriods.mockResolvedValue(
      [0, 1, 2, 3, 4].map((offset) => periodAtOffset(offset, 27)),
    );
    const targetPeriod = periodAtOffset(3, 27);

    await createGoal(dayOfPeriod(targetPeriod, 26), 692.5, payDayUser);
    const beforePayDay = trancheePeriods().length;
    spread.fanOut.mockClear();
    await createGoal(dayOfPeriod(targetPeriod, 27), 692.5, payDayUser);

    expect(trancheePeriods().length).toBe(beforePayDay + 1);
  });

  it('should create the goal without any forecast when no contribution is opted in', async () => {
    const result = await createGoal(
      dayOfPeriod(periodAtOffset(2), 15),
      undefined,
    );

    expect(result.id).toBe(GOAL_ID);
    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(repo.findMaterializedPeriods).not.toHaveBeenCalled();
  });

  it('should still create the goal when no budget exists in the horizon', async () => {
    repo.findMaterializedPeriods.mockResolvedValue([periodAtOffset(-3)]);

    const result = await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    expect(result.id).toBe(GOAL_ID);
    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should still create the goal when the fan-out fails', async () => {
    spread.fanOut.mockRejectedValue(new Error('spread down'));

    const result = await createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5);

    expect(result.id).toBe(GOAL_ID);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should surface a committed fan-out recalculation failure', async () => {
    spread.fanOut.mockRejectedValue(
      new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_SPREAD_RECALCULATION_FAILED,
        undefined,
        { partialFailure: true, affectedBudgetIds: ['budget-1'] },
      ),
    );

    expect(
      createGoal(dayOfPeriod(periodAtOffset(2), 15), 692.5),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED',
      loggingContext: {
        partialFailure: true,
        affectedBudgetIds: ['budget-1'],
        savingsGoalId: GOAL_ID,
      },
    });
  });
});
