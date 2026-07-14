import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PROVISIONING_PORT } from '@modules/budget/domain/ports/budget-provisioning.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
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
  let provisioning: { ensureBudgetsForPeriods: ReturnType<typeof jest.fn> };
  let templateRepo: Record<string, ReturnType<typeof jest.fn>>;
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
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        userId: user.id,
        targetAmount: 24_000,
        targetDate: `${periods[23].year}-${String(periods[23].month).padStart(2, '0')}-15`,
        status: 'ACTIVE',
        createdAt: now.toISOString(),
      }),
      findPayDayOfMonth: jest.fn().mockResolvedValue(null),
      findMaterializedPeriods: jest.fn().mockResolvedValue(periods.slice(0, 2)),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValueOnce({ lines: existingLines, transactions: [] })
        .mockResolvedValue({ lines: allLines, transactions: [] }),
      applyPlan: jest.fn().mockResolvedValue({
        updatedLines: [],
        touchedBudgetIds: periods.map((_, index) => `budget-${index}`),
      }),
    };
    provisioning = {
      ensureBudgetsForPeriods: jest.fn().mockResolvedValue({
        budgetIdByPeriod: new Map(),
        createdBudgets: periods.slice(2).map((item, index) => ({
          id: `budget-${index + 2}`,
          ...item,
        })),
        skippedMonths: [],
      }),
    };
    templateRepo = {
      findDefaultTemplateId: jest.fn().mockResolvedValue('template-1'),
      findLinesByTemplateId: jest
        .fn()
        .mockResolvedValue([{ kind: 'saving', savingsGoalId: 'goal-1' }]),
    };
    recalculation = { recalculate: jest.fn().mockResolvedValue(undefined) };
    cache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    logger = { info: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ApplySavingsGoalPlanUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        { provide: BUDGET_PROVISIONING_PORT, useValue: provisioning },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: templateRepo },
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

    expect(provisioning.ensureBudgetsForPeriods).toHaveBeenCalledWith(
      periods.slice(2),
      'template-1',
      user.id,
    );
    expect(repo.applyPlan).toHaveBeenCalledTimes(1);
    expect(repo.applyPlan.mock.calls[0][1]).toHaveLength(24);
    expect(recalculation.recalculate).toHaveBeenCalledTimes(24);
  });

  it('rejects missing periods before provisioning when no linked default template exists', async () => {
    templateRepo.findDefaultTemplateId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_PLAN_MONTH_UNPROVISIONABLE',
    });
    expect(provisioning.ensureBudgetsForPeriods).not.toHaveBeenCalled();
    expect(repo.applyPlan).not.toHaveBeenCalled();
  });

  it('rejects a materialized budget without a linked saving line', async () => {
    repo.findMaterializedPeriods.mockResolvedValue([
      ...periods.slice(0, 2),
      periods[2],
    ]);

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'ERR_SAVINGS_GOAL_PLAN_LINE_INVALID' });
    expect(provisioning.ensureBudgetsForPeriods).not.toHaveBeenCalled();
  });

  it('rejects a default template whose saving line is not linked to the goal', async () => {
    templateRepo.findLinesByTemplateId.mockResolvedValue([
      { kind: 'saving', savingsGoalId: null },
    ]);

    await expect(
      useCase.execute(
        'goal-1',
        {
          monthAdjustments: [],
          missingMonthAdjustments: [{ ...periods[2], amount: 1000 }],
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_PLAN_MONTH_UNPROVISIONABLE',
    });
    expect(provisioning.ensureBudgetsForPeriods).not.toHaveBeenCalled();
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
    expect(provisioning.ensureBudgetsForPeriods).not.toHaveBeenCalled();
  });

  it('invalidates after partial provisioning when one period is skipped', async () => {
    provisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map(),
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

    expect(provisioning.ensureBudgetsForPeriods).toHaveBeenCalledTimes(1);
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
    repo.findMaterializedPeriods.mockResolvedValue(periods);

    await expect(useCase.execute('goal-1', dto, user)).resolves.toBeDefined();

    expect(provisioning.ensureBudgetsForPeriods).toHaveBeenCalledTimes(1);
    expect(repo.applyPlan).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ provisionedMonthCount: 0 }),
      'Savings goal plan applied',
    );
  });
});
