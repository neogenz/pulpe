import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_LINE_SPREAD_PORT } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { ApplySavingsGoalPlanUseCase } from './apply-savings-goal-plan.use-case';

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

describe('ApplySavingsGoalPlanUseCase provisioning', () => {
  let useCase: ApplySavingsGoalPlanUseCase;
  let periods: { month: number; year: number }[];
  let existingLines: Record<string, unknown>[];
  let allLines: Record<string, unknown>[];
  let repo: Record<string, ReturnType<typeof jest.fn>>;
  let spread: { fanOut: ReturnType<typeof jest.fn> };
  let recalculation: { recalculate: ReturnType<typeof jest.fn> };
  let cache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let logger: { info: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    const now = new Date();
    const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
    periods = Array.from({ length: 24 }, (_, index) =>
      periodFromIndex(currentIndex + index),
    );
    const line = (index: number) => ({
      id: `line-${index}`,
      amount: 0,
      kind: 'saving',
      checkedAt: null,
      isManuallyAdjusted: false,
      ...periods[index],
    });
    existingLines = [line(0), line(1)];
    allLines = periods.map((_, index) => line(index));
    repo = {
      findBalanceRevision: jest.fn().mockResolvedValue(7),
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        userId: user.id,
        name: 'Maison',
        targetAmount: 24_000,
        initialAmount: 10_000,
        targetDate: `${periods[23].year}-${String(periods[23].month).padStart(2, '0')}-15`,
        status: 'ACTIVE',
        createdAt: now.toISOString(),
      }),
      findMaterializedPeriods: jest.fn(),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValueOnce({ lines: existingLines, transactions: [] })
        .mockResolvedValue({ lines: allLines, transactions: [] }),
      findLinkedWithdrawals: jest.fn().mockResolvedValue([]),
      findPlannedWithdrawals: jest.fn().mockResolvedValue([]),
      findPlanWithdrawals: jest.fn().mockResolvedValue([]),
      applyPlan: jest.fn().mockResolvedValue({
        updatedLines: [],
        touchedBudgetIds: periods.map((_, index) => `budget-${index}`),
      }),
    };
    spread = {
      fanOut: jest.fn().mockResolvedValue({
        spreadGroupId: 'group-1',
        lines: [],
        createdBudgets: periods.slice(2).map((item, index) => ({
          id: `budget-${index + 2}`,
          ...item,
        })),
        skippedMonths: [],
      }),
    };
    recalculation = { recalculate: jest.fn().mockResolvedValue(undefined) };
    cache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    logger = { info: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ApplySavingsGoalPlanUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        { provide: BUDGET_LINE_SPREAD_PORT, useValue: spread },
        { provide: BUDGET_RECALCULATION_PORT, useValue: recalculation },
        { provide: CacheService, useValue: cache },
        {
          provide: `INFO_LOGGER:${ApplySavingsGoalPlanUseCase.name}`,
          useValue: logger,
        },
      ],
    }).compile();
    useCase = module.get(ApplySavingsGoalPlanUseCase);
  });

  it('routes a signed plan-only withdrawal without provisioning a budget', async () => {
    repo.applyPlan.mockResolvedValueOnce({
      updatedLines: [],
      touchedBudgetIds: [],
    });

    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        planWithdrawalAdjustments: [{ ...periods[0], amount: -4_500 }],
      },
      user,
    );

    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(repo.applyPlan).toHaveBeenCalledWith(
      'goal-1',
      [],
      expect.any(Number),
      [{ ...periods[0], amount: -4_500 }],
      7,
    );
    expect(recalculation.recalculate).not.toHaveBeenCalled();
  });

  it('routes zero as removal of an existing plan-only withdrawal', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        planWithdrawalAdjustments: [{ ...periods[0], amount: 0 }],
      },
      user,
    );

    expect(repo.applyPlan).toHaveBeenCalledWith(
      'goal-1',
      [],
      expect.any(Number),
      [{ ...periods[0], amount: 0 }],
      7,
    );
  });

  it('atomically replaces a plan-only withdrawal with one positive line adjustment', async () => {
    repo.applyPlan.mockResolvedValueOnce({
      updatedLines: [],
      touchedBudgetIds: [],
    });
    const budgetLineId = existingLines[0].id as string;

    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [{ budgetLineId, amount: 1_260 }],
        planWithdrawalAdjustments: [{ ...periods[0], amount: 0 }],
      },
      user,
    );

    expect(repo.applyPlan).toHaveBeenCalledWith(
      'goal-1',
      [{ budgetLineId, amount: 1_260 }],
      expect.any(Number),
      [{ ...periods[0], amount: 0 }],
      7,
    );
  });

  it('reads the balance revision before the rows used by the withdrawal guard', async () => {
    const callOrder: string[] = [];
    repo.findBalanceRevision.mockImplementation(async () => {
      callOrder.push('revision');
      return 7;
    });
    repo.findById.mockImplementation(async () => {
      callOrder.push('goal');
      return {
        id: 'goal-1',
        userId: user.id,
        name: 'Maison',
        targetAmount: 24_000,
        initialAmount: 10_000,
        targetDate: `${periods[23].year}-${String(periods[23].month).padStart(2, '0')}-15`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
    });
    repo.findLinkedContributions.mockReset().mockImplementation(async () => {
      callOrder.push('linked');
      return { lines: existingLines, transactions: [] };
    });

    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        planWithdrawalAdjustments: [{ ...periods[0], amount: -450 }],
      },
      user,
    );

    expect(callOrder).toEqual(['goal', 'linked', 'revision', 'linked', 'goal']);
  });

  it('rejects a direct withdrawal that would make the projected stock negative', async () => {
    repo.findById.mockResolvedValue({
      id: 'goal-1',
      userId: user.id,
      name: 'Petit pot',
      targetAmount: 1_000,
      targetDate: `${periods[23].year}-${String(periods[23].month).padStart(2, '0')}-15`,
      initialAmount: 1_000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          planWithdrawalAdjustments: [{ ...periods[0], amount: -4_500 }],
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE',
    });
    expect(repo.applyPlan).not.toHaveBeenCalled();
  });

  it('provisions the 22 missing budgets then applies all 24 monthly shares once', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: existingLines.map((line) => ({
          budgetLineId: line.id as string,
          amount: 1000,
        })),
        missingMonthAdjustments: periods.slice(2).map((item) => ({
          ...item,
          amount: 1000,
        })),
      },
      user,
    );

    expect(spread.fanOut.mock.calls[0][0].tranches).toEqual(
      periods.slice(2).map((item) => ({ ...item, amount: 1000 })),
    );
    expect(repo.applyPlan).toHaveBeenCalledTimes(1);
    expect(repo.applyPlan.mock.calls[0][1]).toHaveLength(24);
    expect(recalculation.recalculate).toHaveBeenCalledTimes(24);
  });

  it('fills a missing month with a linked forecast, no Mois Type line involved', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
      },
      user,
    );

    const [input] = spread.fanOut.mock.calls[0];
    expect(input.kind).toBe('saving');
    expect(input.savingsGoalId).toBe('goal-1');
    expect(input.name).toBe('Maison');
    expect(input.tranches).toEqual([{ ...periods[2], amount: 1000 }]);
  });

  it('applies existing-line adjustments when the objective has no deadline', async () => {
    repo.findById.mockResolvedValue({
      id: 'goal-1',
      userId: user.id,
      name: 'Pot libre',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [
          { budgetLineId: existingLines[0].id as string, amount: 500 },
        ],
      },
      user,
    );

    expect(repo.applyPlan).toHaveBeenCalledTimes(1);
  });

  it('does not provision missing months for an objective without a deadline', async () => {
    repo.findById.mockResolvedValue({
      id: 'goal-1',
      userId: user.id,
      name: 'Pot libre',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...periods[2], amount: 500 }],
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'ERR_SAVINGS_GOAL_PLAN_LINE_INVALID' });
    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(repo.applyPlan).not.toHaveBeenCalled();
  });

  it('creates the missing linked forecast in an already-materialized budget', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
      },
      user,
    );

    expect(spread.fanOut).toHaveBeenCalledWith(
      expect.objectContaining({
        savingsGoalId: 'goal-1',
        tranches: [{ ...periods[2], amount: 1000 }],
      }),
      user,
    );
    expect(repo.applyPlan).toHaveBeenCalledTimes(1);
  });

  it('drops a zero-amount gap without taking the valid adjustment down with it', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [
          { budgetLineId: existingLines[0].id as string, amount: 500 },
        ],
        missingMonthAdjustments: [{ ...periods[2], amount: 0 }],
      },
      user,
    );

    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(repo.applyPlan.mock.calls[0][1]).toEqual([
      { budgetLineId: existingLines[0].id, amount: 500 },
    ]);
  });

  it('provisions nothing when every gap an older client sent is zero', async () => {
    await useCase.execute(
      'goal-1',
      {
        monthAdjustments: [],
        missingMonthAdjustments: periods
          .slice(2, 5)
          .map((item) => ({ ...item, amount: 0 })),
      },
      user,
    );

    expect(spread.fanOut).not.toHaveBeenCalled();
    expect(repo.applyPlan.mock.calls[0][1]).toEqual([]);
  });

  it('rejects a missing period outside the goal horizon', async () => {
    const afterTarget = periodFromIndex(
      periods[23].year * 12 + periods[23].month + 1,
    );

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...afterTarget, amount: 1000 }],
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'ERR_SAVINGS_GOAL_PLAN_LINE_INVALID' });
    expect(spread.fanOut).not.toHaveBeenCalled();
  });

  it('invalidates after partial provisioning when one period is skipped', async () => {
    spread.fanOut.mockResolvedValue({
      spreadGroupId: 'group-1',
      lines: [],
      createdBudgets: [{ id: 'budget-created' }],
      skippedMonths: [periods[3]],
    });

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: periods.slice(2, 4).map((item) => ({
            ...item,
            amount: 1000,
          })),
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_PLAN_MONTH_UNPROVISIONABLE',
    });
    expect(cache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(repo.applyPlan).not.toHaveBeenCalled();
  });

  it('keeps provisioned budgets visible when the final amount RPC fails', async () => {
    repo.applyPlan.mockRejectedValueOnce(new Error('rpc failed'));

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
        },
        user,
      ),
    ).rejects.toThrow('rpc failed');

    expect(spread.fanOut).toHaveBeenCalledTimes(1);
    expect(cache.invalidateForUser).toHaveBeenCalledWith(user.id);
    expect(recalculation.recalculate).not.toHaveBeenCalled();
  });

  it('reuses linked budgets provisioned before a failed final RPC on retry', async () => {
    const dto = {
      monthAdjustments: existingLines.map((line) => ({
        budgetLineId: line.id as string,
        amount: 1000,
      })),
      missingMonthAdjustments: periods.slice(2).map((item) => ({
        ...item,
        amount: 1000,
      })),
    };
    repo.applyPlan.mockRejectedValueOnce(new Error('rpc failed'));

    await expect(useCase.execute('goal-1', dto, user)).rejects.toThrow(
      'rpc failed',
    );

    await expect(useCase.execute('goal-1', dto, user)).resolves.toBeDefined();

    expect(spread.fanOut).toHaveBeenCalledTimes(1);
    expect(repo.applyPlan).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ provisionedMonthCount: 0 }),
      'Savings goal plan applied',
    );
  });
});
