import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { CacheService } from '@modules/cache/cache.service';
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

describe('UpdateSavingsGoalUseCase', () => {
  let useCase: UpdateSavingsGoalUseCase;
  let repo: {
    findById: ReturnType<typeof jest.fn>;
    findLinkedSavingLines: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
    reconcileTargetDate: ReturnType<typeof jest.fn>;
  };
  let recalculate: ReturnType<typeof jest.fn>;
  let invalidateForUser: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn().mockResolvedValue(goal),
      findLinkedSavingLines: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(goal),
      reconcileTargetDate: jest.fn().mockResolvedValue({
        goal,
        affectedLineIds: [],
        touchedBudgetIds: [],
      }),
    };
    recalculate = jest.fn().mockResolvedValue(undefined);
    invalidateForUser = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        UpdateSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        {
          provide: BUDGET_RECALCULATION_PORT,
          useValue: { recalculate },
        },
        {
          provide: CacheService,
          useValue: { invalidateForUser },
        },
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

  it('requires a decision before advancing a deadline with eligible lines', async () => {
    repo.findLinkedSavingLines.mockResolvedValue([
      {
        id: '11111111-2222-4333-8444-555555555555',
        amount: 500,
        kind: 'saving',
        checkedAt: null,
        isManuallyAdjusted: false,
        month: 4,
        year: 2030,
      },
    ]);

    await expect(
      useCase.execute('goal-1', { targetDate: '2030-03-15' }, user),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_RECONCILIATION_REQUIRED',
    });
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.reconcileTargetDate).not.toHaveBeenCalled();
  });

  it('reconciles the exact preview decision and the whole patch atomically', async () => {
    const lineId = '11111111-2222-4333-8444-555555555555';
    repo.findLinkedSavingLines.mockResolvedValue([
      {
        id: lineId,
        amount: 500,
        kind: 'saving',
        checkedAt: null,
        isManuallyAdjusted: false,
        month: 4,
        year: 2030,
      },
    ]);
    repo.reconcileTargetDate.mockResolvedValue({
      goal: { ...goal, name: 'Maison proche', targetDate: '2030-03-15' },
      affectedLineIds: [lineId],
      touchedBudgetIds: ['budget-1'],
    });
    const callOrder: string[] = [];
    invalidateForUser.mockImplementation(async () => {
      callOrder.push('invalidate');
    });
    recalculate.mockImplementation(async () => {
      callOrder.push('recalculate');
    });

    const result = await useCase.execute(
      'goal-1',
      {
        name: 'Maison proche',
        targetAmount: 80_000,
        targetDate: '2030-03-15',
        reconciliation: { mode: 'freeze', budgetLineIds: [lineId] },
      },
      user,
    );

    expect(result.name).toBe('Maison proche');
    expect(repo.reconcileTargetDate).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({
        patch: {
          name: 'Maison proche',
          targetAmount: 80_000,
          targetDate: '2030-03-15',
        },
        reconciliation: { mode: 'freeze', budgetLineIds: [lineId] },
        expectedTargetDate: '2030-05-15',
      }),
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['invalidate', 'recalculate']);
  });

  it.each([
    ['later', goal, '2030-06-15'],
    ['identical', goal, '2030-05-15'],
    ['removed', goal, null],
    ['added to undated', { ...goal, targetDate: null }, '2030-05-15'],
  ] as const)(
    'uses the ordinary PATCH when the target date is %s',
    async (_label, currentGoal, targetDate) => {
      repo.findById.mockResolvedValue(currentGoal);

      await useCase.execute('goal-1', { targetDate }, user);

      expect(repo.update).toHaveBeenCalledWith('goal-1', { targetDate });
      expect(repo.findLinkedSavingLines).not.toHaveBeenCalled();
      expect(repo.reconcileTargetDate).not.toHaveBeenCalled();
    },
  );

  it('uses the ordinary PATCH when an earlier ISO date stays in the same payDay-aware period', async () => {
    repo.findLinkedSavingLines.mockResolvedValue([
      {
        id: '11111111-2222-4333-8444-555555555555',
        amount: 500,
        kind: 'saving',
        checkedAt: null,
        isManuallyAdjusted: false,
        month: 6,
        year: 2030,
      },
    ]);

    await useCase.execute(
      'goal-1',
      { targetDate: '2030-04-26' },
      { ...user, payDayOfMonth: 25 },
    );

    expect(repo.update).toHaveBeenCalledWith('goal-1', {
      targetDate: '2030-04-26',
    });
    expect(repo.findLinkedSavingLines).not.toHaveBeenCalled();
    expect(repo.reconcileTargetDate).not.toHaveBeenCalled();
  });

  it('reconciles an earlier deadline with an empty internal snapshot', async () => {
    repo.findLinkedSavingLines.mockResolvedValue([]);

    await useCase.execute('goal-1', { targetDate: '2030-03-15' }, user);

    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.reconcileTargetDate).toHaveBeenCalledWith('goal-1', {
      patch: { targetDate: '2030-03-15' },
      reconciliation: { mode: 'freeze', budgetLineIds: [] },
      expectedTargetDate: '2030-05-15',
    });
    expect(invalidateForUser).not.toHaveBeenCalled();
    expect(recalculate).not.toHaveBeenCalled();
  });

  it('reports recalculation failure as critical after the transaction committed', async () => {
    const lineId = '11111111-2222-4333-8444-555555555555';
    repo.findLinkedSavingLines.mockResolvedValue([
      {
        id: lineId,
        amount: 500,
        kind: 'saving',
        checkedAt: null,
        isManuallyAdjusted: false,
        month: 4,
        year: 2030,
      },
    ]);
    repo.reconcileTargetDate.mockResolvedValue({
      goal: { ...goal, targetDate: '2030-03-15' },
      affectedLineIds: [lineId],
      touchedBudgetIds: ['budget-1'],
    });
    recalculate.mockRejectedValue(new Error('down'));

    await expect(
      useCase.execute(
        'goal-1',
        {
          targetDate: '2030-03-15',
          reconciliation: { mode: 'remove', budgetLineIds: [lineId] },
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED',
      loggingContext: {
        partialFailure: true,
        affectedBudgetIds: ['budget-1'],
      },
    });
  });

  it('reports cache invalidation failure as critical after the transaction committed', async () => {
    const lineId = '11111111-2222-4333-8444-555555555555';
    repo.findLinkedSavingLines.mockResolvedValue([
      {
        id: lineId,
        amount: 500,
        kind: 'saving',
        checkedAt: null,
        isManuallyAdjusted: false,
        month: 4,
        year: 2030,
      },
    ]);
    repo.reconcileTargetDate.mockResolvedValue({
      goal: { ...goal, targetDate: '2030-03-15' },
      affectedLineIds: [lineId],
      touchedBudgetIds: ['budget-1'],
    });
    invalidateForUser.mockRejectedValue(new Error('cache down'));

    await expect(
      useCase.execute(
        'goal-1',
        {
          targetDate: '2030-03-15',
          reconciliation: { mode: 'freeze', budgetLineIds: [lineId] },
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED',
      loggingContext: {
        partialFailure: true,
        affectedBudgetIds: ['budget-1'],
      },
    });
    expect(recalculate).not.toHaveBeenCalled();
  });
});
