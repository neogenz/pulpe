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
    startDate: null,
    targetAmount: 800,
    targetDate: '2026-08-01',
    plannedCumulative: 400,
    plannedProjection: 400,
    confirmed: 0,
    initialAmount: 0,
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

  it('keeps monthly adjustments available without inventing a target', () => {
    progressSig.set(
      makeProgress({
        targetAmount: null,
        targetDate: null,
        achievementPercent: null,
        monthsRemaining: null,
        required: null,
        projected: null,
        paceStatus: null,
        suggestCompletion: null,
      }),
    );

    expect(store.canSimulate()).toBe(true);
    expect(store.targetAmount()).toBeNull();

    store.enter();
    store.setMonth(6, 2026, 500);

    expect(store.draft()?.gapToTarget).toBeNull();
    expect(store.draft()?.isTargetMet).toBeNull();
    expect(store.draft()?.attainedPeriod).toBeNull();
    expect(store.buildApplyPayload().monthAdjustments).toEqual([
      { budgetLineId: LINE_CURRENT, amount: 500 },
    ]);
    expect(store.redistribute().isDistributable).toBe(false);
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

  it('keeps a negative movement out of saving lines and routes its chosen destination', () => {
    store.enter();
    store.setMonth(6, 2026, -4_500);

    const payload = store.buildApplyPayload('linked_income');

    expect(payload.monthAdjustments).toEqual([]);
    expect(payload.planWithdrawalAdjustments).toEqual([
      {
        month: 6,
        year: 2026,
        amount: -4_500,
        destination: 'linked_income',
      },
    ]);
  });

  it('keeps a goal-only negative movement when the month has no budget', () => {
    progressSig.set(
      makeProgress({
        months: [
          {
            month: 9,
            year: 2026,
            state: 'gap',
            isLocked: false,
            hasBudget: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: [],
          },
        ],
      }),
    );
    store.enter();
    store.setMonth(9, 2026, -450);

    expect(store.buildApplyPayload()).toMatchObject({
      monthAdjustments: [],
      missingMonthAdjustments: [],
      planWithdrawalAdjustments: [
        {
          month: 9,
          year: 2026,
          amount: -450,
          destination: 'goal_only',
        },
      ],
    });
  });

  it('clears a reloaded managed withdrawal when the month becomes positive', () => {
    progressSig.set(
      makeProgress({
        months: [
          openMonth(6, LINE_CURRENT, 1_260, {
            planLinkedWithdrawalAmount: 4_500,
            plannedWithdrawalAmount: 4_500,
            remainingPlannedWithdrawalAmount: 4_500,
          }),
        ],
      }),
    );
    store.enter();
    store.setMonth(6, 2026, 1_500);

    expect(store.buildApplyPayload().planWithdrawalAdjustments).toEqual([
      {
        month: 6,
        year: 2026,
        amount: 0,
        destination: 'goal_only',
      },
    ]);
  });

  it('accepts a signed month amount but ignores a non-finite value', () => {
    store.enter();
    store.setMonth(6, 2026, 500);

    store.setMonth(6, 2026, -500);
    store.setMonth(6, 2026, Number.NaN);

    const june = store.draft()!.months.find((m) => m.month === 6)!;
    expect(june.simulatedAmount).toBe(-500);
  });

  it('ignores a negative global amount instead of clamping it to zero', () => {
    store.enter();
    store.setGlobalAmount(300);

    store.setGlobalAmount(-500);

    expect(store.globalAmount()).toBe(300);
    expect(store.draft()!.months.every((m) => m.simulatedAmount === 300)).toBe(
      true,
    );
  });

  it('closes canApply while an entry is refused, then reopens it', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    expect(store.canApply()).toBe(true);

    store.setMonthAmountInvalid(true);
    expect(store.hasChanges()).toBe(true);
    expect(store.canApply()).toBe(false);

    store.setMonthAmountInvalid(false);
    expect(store.canApply()).toBe(true);
  });

  // Le montant global et le champ inline d'un mois refusent chacun pour soi :
  // ouvrir l'un ne lève pas le refus que l'autre affiche encore.
  it('keeps a refused global amount closed when a month reports itself valid', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    store.setGlobalAmountInvalid(true);

    store.setMonthAmountInvalid(false);

    expect(store.canApply()).toBe(false);
  });

  it('keeps a refused month closed when the global amount reports itself valid', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    store.setMonthAmountInvalid(true);

    store.setGlobalAmountInvalid(false);

    expect(store.canApply()).toBe(false);
  });

  it('reopens canApply once both fields are lifted', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    store.setGlobalAmountInvalid(true);
    store.setMonthAmountInvalid(true);

    store.setGlobalAmountInvalid(false);
    store.setMonthAmountInvalid(false);

    expect(store.canApply()).toBe(store.hasChanges());
    expect(store.canApply()).toBe(true);
  });

  it('clears both refused entries when the simulation is reset', () => {
    store.enter();
    store.setMonth(6, 2026, 500);
    store.setGlobalAmountInvalid(true);
    store.setMonthAmountInvalid(true);

    store.revert();

    expect(store.hasInvalidAmount()).toBe(false);
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

  it('seeds simulateSavingsPlan with initialAmount (PUL-293): the verdict is reached earlier', () => {
    // Baseline (initialAmount 0): 200/mo over 2 months only reaches 400 of 800
    // → never met. Seeding 500 pushes June to 700 and July to 900 ≥ target.
    progressSig.set(makeProgress({ initialAmount: 500 }));
    store.enter();

    const draft = store.draft()!;
    expect(draft.isTargetMet).toBe(true);
    expect(draft.attainedPeriod).toEqual({ month: 7, year: 2026 });
  });

  it('seeds redistributeRemainingEffort with initialAmount (PUL-293): remaining effort shrinks', () => {
    // Same target (800) and 2 open months as the no-seed case above (400/mo),
    // but 400 already banked → only 400 left to split over 2 months = 200/mo.
    progressSig.set(makeProgress({ initialAmount: 400 }));
    store.enter();

    const result = store.redistribute();
    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(400);
    expect(result.perRemainingMonth).toBe(200);
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

  it('preserves non-uniform cents across provisionable periods', () => {
    const startIndex = 2026 * 12 + 6;
    const months = Array.from({ length: 24 }, (_, offset) => {
      const index = startIndex + offset;
      const year = Math.floor((index - 1) / 12);
      const month = index - year * 12;
      if (offset < 2) {
        return openMonth(month, offset === 0 ? LINE_CURRENT : LINE_FUTURE, 0, {
          year,
        });
      }
      return {
        month,
        year,
        state: 'gap' as const,
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
        targetAmount: 24_000.23,
        required: 1000,
        monthsRemaining: 24,
        months,
      }),
    );

    store.enter();
    const result = store.redistribute();
    const payload = store.buildApplyPayload();

    expect(result.isDistributable).toBe(true);
    expect(result.perRemainingMonth).toBe(1000.01);
    expect(payload.missingMonthAdjustments).toEqual(
      months.slice(2).map((month, index) => ({
        month: month.month,
        year: month.year,
        amount: index < 21 ? 1000.01 : 1000,
      })),
    );
    expect(
      [
        ...payload.monthAdjustments,
        ...(payload.missingMonthAdjustments ?? []),
      ].reduce(
        (sum, adjustment) => sum + Math.round(adjustment.amount * 100),
        0,
      ),
    ).toBe(2_400_023);
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

  it('omits a zero-valued gap creation while keeping a zero-valued existing-line adjustment', () => {
    progressSig.set(
      makeProgress({
        targetAmount: 200,
        initialAmount: 200,
        months: [
          openMonth(6, LINE_CURRENT, 200, { plannedCumulative: 200 }),
          {
            month: 7,
            year: 2026,
            state: 'gap',
            isLocked: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 200,
            confirmedCumulative: 0,
            lines: [],
          },
        ],
      }),
    );
    store.enter();

    const result = store.redistribute();
    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(0);

    const payload = store.buildApplyPayload();

    expect(payload.monthAdjustments).toEqual([
      { budgetLineId: LINE_CURRENT, amount: 0 },
    ]);
    expect(payload.missingMonthAdjustments).toEqual([]);
  });

  it('keeps a valid adjustment when a zero-valued gap creation is dropped from the same submission', () => {
    progressSig.set(
      makeProgress({
        targetAmount: 500,
        initialAmount: 0,
        months: [
          openMonth(6, LINE_CURRENT, 200, { plannedCumulative: 200 }),
          {
            month: 7,
            year: 2026,
            state: 'gap',
            isLocked: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 200,
            confirmedCumulative: 0,
            lines: [],
          },
        ],
      }),
    );
    store.enter();
    store.setMonth(6, 2026, 500);

    const result = store.redistribute();
    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(0);

    const payload = store.buildApplyPayload();

    expect(payload.monthAdjustments).toEqual([
      { budgetLineId: LINE_CURRENT, amount: 500 },
    ]);
    expect(payload.missingMonthAdjustments).toEqual([]);
  });

  it('skips the apply call when the only change is a zero-valued gap creation', async () => {
    progressSig.set(
      makeProgress({
        targetAmount: 500,
        initialAmount: 500,
        months: [
          {
            month: 7,
            year: 2026,
            state: 'gap',
            isLocked: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: [],
          },
        ],
      }),
    );
    store.enter();

    const result = store.redistribute();
    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(0);

    const payload = store.buildApplyPayload();
    expect(payload.monthAdjustments).toEqual([]);
    expect(payload.missingMonthAdjustments).toEqual([]);

    await store.apply();

    expect(applyPlan).not.toHaveBeenCalled();
    expect(store.isSimulating()).toBe(false);
  });

  it('keeps the preview and payload in parity: both drop the zero-valued gap, both keep the valid adjustment', () => {
    progressSig.set(
      makeProgress({
        targetAmount: 500,
        initialAmount: 0,
        months: [
          openMonth(6, LINE_CURRENT, 200, { plannedCumulative: 200 }),
          {
            month: 7,
            year: 2026,
            state: 'gap',
            isLocked: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 200,
            confirmedCumulative: 0,
            lines: [],
          },
        ],
      }),
    );
    store.enter();
    store.setMonth(6, 2026, 500);
    store.redistribute();

    // Same filter savings-goal-detail-page.ts#onApplyPlan applies to build the
    // confirmation preview — mirrored here so a drift between preview and
    // payload fails this test before it ever reaches the UI.
    const previewedMonths = store
      .draft()!
      .months.filter(
        (month) =>
          month.isAdjusted &&
          !(month.isProvisionable && month.simulatedAmount <= 0),
      );

    expect(previewedMonths).toHaveLength(1);
    expect(previewedMonths[0].month).toBe(6);

    const payload = store.buildApplyPayload();
    expect(payload.monthAdjustments).toEqual([
      { budgetLineId: LINE_CURRENT, amount: 500 },
    ]);
    expect(payload.missingMonthAdjustments).toEqual([]);
  });
});
