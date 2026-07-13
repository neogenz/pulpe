import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type {
  SavingsGoal,
  SavingsGoalPlanMonth,
  SavingsGoalProgress,
} from 'pulpe-shared';
import { GoalPlanSimulatorStore } from './goal-plan-simulator-store';
import { SavingsGoalStore } from '../../services/savings-goals-store';

const LINE_CURRENT = '11111111-1111-4111-8111-111111111111';
const LINE_FUTURE = '22222222-2222-4222-8222-222222222222';

function openMonth(
  month: number,
  budgetLineId: string,
  amount: number,
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month,
    year: 2026,
    state: month === 6 ? 'current' : 'future',
    isLocked: false,
    plannedAmount: amount,
    confirmedAmount: 0,
    plannedCumulative: amount,
    confirmedCumulative: 0,
    lines: [
      { budgetLineId, amount, checkedAt: null, isManuallyAdjusted: false },
    ],
    ...overrides,
  };
}

function makeProgress(
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: 'goal-1',
    status: 'ACTIVE',
    targetAmount: 800,
    targetDate: '2026-08-01',
    plannedCumulative: 400,
    confirmed: 0,
    achievementPercent: 0,
    monthsElapsed: 1,
    monthsRemaining: 2,
    isOverdue: false,
    pace: 400,
    confirmedPace: 0,
    required: 400,
    projected: 0,
    paceStatus: 'on_track',
    suggestCompletion: false,
    linkedLineCount: 2,
    cumulativeGap: 400,
    estimatedCompletion: null,
    months: [
      openMonth(6, LINE_CURRENT, 200, { plannedCumulative: 200 }),
      openMonth(7, LINE_FUTURE, 200, { plannedCumulative: 400 }),
    ],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

function makeGoal(): SavingsGoal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Vacances',
    targetAmount: 800,
    targetDate: '2026-08-01',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as SavingsGoal;
}

describe('GoalPlanSimulatorStore', () => {
  let store: GoalPlanSimulatorStore;
  const progressSig = signal<SavingsGoalProgress | null>(makeProgress());
  const selectedGoalSig = signal<SavingsGoal | null>(makeGoal());
  const applyPlan = vi.fn().mockResolvedValue({
    updatedLines: [],
  });

  beforeEach(() => {
    progressSig.set(makeProgress());
    selectedGoalSig.set(makeGoal());
    applyPlan.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        GoalPlanSimulatorStore,
        {
          provide: SavingsGoalStore,
          useValue: {
            progress: progressSig,
            selectedGoal: selectedGoalSig,
            applyPlan,
          },
        },
      ],
    });
    store = TestBed.inject(GoalPlanSimulatorStore);
  });

  it('gates canSimulate on ACTIVE + linked lines + open months', () => {
    expect(store.canSimulate()).toBe(true);
    expect(store.openMonthCount()).toBe(2);

    progressSig.set(makeProgress({ status: 'PAUSED' }));
    expect(store.canSimulate()).toBe(false);
  });

  it('produces no draft until simulation is entered', () => {
    expect(store.draft()).toBeNull();
    store.enter();
    expect(store.isSimulating()).toBe(true);
    expect(store.draft()).not.toBeNull();
  });

  it('seeds the slider on the current plan amount, not the deadline anchor', () => {
    // makeProgress: open months planned 200/mo; required (deadline anchor) 400.
    // Option C — the slider must open where the plan actually is (200), so it
    // stays consistent with the verdict; the anchor (400) is only a target hint.
    expect(store.currentMonthlyAmount()).toBe(200);
    expect(store.defaultMonthlyAmount()).toBe(400);

    // Entering simulation changes nothing: the draft keeps the current 200/mo,
    // so the seeded slider value matches the simulated plan (no phantom diff).
    store.enter();
    const draft = store.draft()!;
    expect(draft.months.every((m) => m.simulatedAmount === 200)).toBe(true);
    expect(store.dirtyCount()).toBe(0);
  });

  it('falls back to the deadline anchor when there is no open month', () => {
    progressSig.set(makeProgress({ months: [], required: 555 }));
    expect(store.currentMonthlyAmount()).toBe(555);
  });

  it('applies a per-month override to the draft (calculator integration)', () => {
    store.enter();
    store.setMonth(6, 2026, 500);

    const draft = store.draft()!;
    const june = draft.months.find((m) => m.month === 6)!;
    expect(june.simulatedAmount).toBe(500);
    expect(june.isAdjusted).toBe(true);
    expect(store.dirtyCount()).toBe(1);
  });

  it('overwrites per-month overrides when a global amount is set', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    store.setGlobalAmount(300);

    const draft = store.draft()!;
    expect(draft.months.every((m) => m.simulatedAmount === 300)).toBe(true);
  });

  it('redistributes the remaining effort across open months', () => {
    store.enter();
    const result = store.redistribute();

    expect(result.isDistributable).toBe(true);
    // target 800, nothing confirmed → 400 per open month across two months.
    expect(result.perRemainingMonth).toBe(400);
    expect(store.globalAmount()).toBe(400);
    expect(store.hasVariableAmounts()).toBe(false);
    const draft = store.draft()!;
    expect(draft.months.every((m) => m.simulatedAmount === 400)).toBe(true);
    expect(draft.isTargetMet).toBe(true);
  });

  it('redistributes over 2 materialized budgets and 22 provisionable periods', () => {
    const startIndex = 2026 * 12 + 6;
    const periods = Array.from({ length: 24 }, (_, offset) => {
      const index = startIndex + offset;
      const year = Math.floor((index - 1) / 12);
      return { month: index - year * 12, year };
    });
    const months = periods.map((period, index): SavingsGoalPlanMonth => {
      if (index < 2) {
        return openMonth(
          period.month,
          index === 0 ? LINE_CURRENT : LINE_FUTURE,
          0,
          { year: period.year },
        );
      }
      return {
        ...period,
        state: 'gap',
        isLocked: false,
        isProvisionable: true,
        plannedAmount: 0,
        confirmedAmount: 0,
        plannedCumulative: 0,
        confirmedCumulative: 0,
        lines: [],
      };
    });
    progressSig.set(
      makeProgress({
        targetAmount: 24_000,
        required: 1000,
        monthsRemaining: 24,
        months,
      }),
    );

    store.enter();
    const result = store.redistribute();
    const payload = store.buildApplyPayload();

    expect(store.openMonthCount()).toBe(24);
    expect(result.isDistributable).toBe(true);
    expect(result.perRemainingMonth).toBe(1000);
    expect(payload.monthAdjustments).toHaveLength(2);
    expect(payload.missingMonthAdjustments).toEqual(
      periods.slice(2).map((period) => ({ ...period, amount: 1000 })),
    );
    expect('templateAdjustments' in payload).toBe(false);
  });

  it('keeps cents-preserving non-uniform adjustments authoritative', () => {
    progressSig.set(makeProgress({ targetAmount: 800.01 }));
    store.enter();

    const result = store.redistribute();

    expect(result.adjustments.map((adjustment) => adjustment.amount)).toEqual([
      400.01, 400,
    ]);
    expect(store.globalAmount()).toBeNull();
    expect(store.hasVariableAmounts()).toBe(true);
    expect(store.draftRows().map((month) => month.simulatedAmount)).toEqual([
      400.01, 400,
    ]);

    store.setGlobalAmount(350);

    expect(store.hasVariableAmounts()).toBe(false);
  });

  it('does not replace the control amount when redistribution fails', () => {
    progressSig.set(
      makeProgress({
        months: [
          openMonth(6, LINE_CURRENT, 200, {
            isLocked: true,
            lines: [
              {
                budgetLineId: LINE_CURRENT,
                amount: 200,
                checkedAt: '2026-07-01T00:00:00.000Z',
                isManuallyAdjusted: false,
              },
            ],
          }),
        ],
      }),
    );
    store.enter();
    store.setGlobalAmount(300);

    const result = store.redistribute();

    expect(result.isDistributable).toBe(false);
    expect(store.globalAmount()).toBe(300);
  });

  it('builds a line-scoped payload and applies it pessimistically', async () => {
    store.enter();
    store.setMonth(6, 2026, 500);

    const payload = store.buildApplyPayload();
    expect('templateAdjustments' in payload).toBe(false);
    expect(payload.monthAdjustments).toEqual([
      { budgetLineId: LINE_CURRENT, amount: 500 },
    ]);
    expect(payload.missingMonthAdjustments).toEqual([]);

    await store.apply();
    expect(applyPlan).toHaveBeenCalledWith('goal-1', payload);
    // Applying exits the sandbox so the draft is discarded.
    expect(store.isSimulating()).toBe(false);
  });
});
