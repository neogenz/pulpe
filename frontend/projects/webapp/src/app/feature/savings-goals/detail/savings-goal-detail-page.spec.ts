import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import localeDE from '@angular/common/locales/de-CH';
import { of } from 'rxjs';
import {
  API_ERROR_CODES,
  type SavingsGoal,
  type SavingsGoalContribution,
  type SavingsGoalDeletionCommand,
  type SavingsGoalFutureLine,
  type SavingsGoalPlanMonth,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalProgress,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalWithdrawal,
  type SupportedCurrency,
} from 'pulpe-shared';
import { ApiError } from '@core/api/api-error';
import SavingsGoalDetailPage from './savings-goal-detail-page';
import { SavingsGoalStore } from '../services/savings-goals-store';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';
import { UserSettingsStore } from '@core/user-settings';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { GoalProjectionChart } from './components/goal-projection-chart';
import { GoalPlanTimeline } from './components/goal-plan-timeline';
import { GoalPlanSimulatorToolbar } from './components/goal-plan-simulator-toolbar';
import { GoalContributionsList } from './components/goal-contributions-list';
import { GoalWithdrawalsList } from './components/goal-withdrawals-list';
import { GoalPlanRepairCallout } from './components/goal-plan-repair-callout';
import { GoalDeletionDialog } from './components/goal-deletion-dialog';
import { setTestInput } from '../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../testing/transloco-testing';

registerLocaleData(localeDE);

// Stub the state containers so a required-input + transloco binding does not
// throw NG0950 on the first synchronous change detection (project convention).
@Component({
  selector: 'pulpe-state-card',
  template: '<div [attr.data-testid]="testId()"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubStateCard {
  readonly variant = input<string>('error');
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly actionLabel = input<string | null>(null);
  readonly actionDisabled = input(false);
  readonly testId = input('state-card');
  readonly action = output<void>();
}

@Component({
  selector: 'pulpe-base-loading',
  template: '<div [attr.data-testid]="testId()"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubBaseLoading {
  readonly message = input<string>('');
  readonly size = input<string>('medium');
  readonly testId = input<string>('loading-container');
}

// The plan sub-components have their own specs; stub them here so the page test
// stays focused on page logic (view states, D-blocks, simulation plumbing) and
// avoids the canvas / required-input+computed test friction (Angular #54039).
@Component({
  selector: 'pulpe-goal-projection-chart',
  template: '<div data-testid="stub-chart"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalProjectionChart {
  readonly months = input<unknown>();
  readonly draft = input<unknown>(null);
  readonly targetAmount = input<number | null>(null);
  readonly currency = input<string>('CHF');
  readonly confirmed = input<number>(0);
  readonly projected = input<number>(0);
}

@Component({
  selector: 'pulpe-goal-plan-timeline',
  template: '<div data-testid="stub-timeline"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalPlanTimeline {
  readonly months = input<unknown>();
  readonly simulatedMonths = input<unknown>(null);
  readonly plannedWithdrawals = input<unknown>([]);
  readonly currency = input<string>('CHF');
  readonly locale = input<string>('fr-CH');
  readonly payDayOfMonth = input<number | null>(null);
  readonly editable = input<boolean>(false);
  readonly expanded = input<boolean>(false);
  readonly canRepair = input<boolean>(false);
  readonly amountChange = output<unknown>();
  readonly toggleExpanded = output<void>();
}

@Component({
  selector: 'pulpe-goal-plan-simulator-toolbar',
  template: '<div data-testid="stub-toolbar"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalPlanSimulatorToolbar {
  readonly currency = input<string>('CHF');
  readonly verdict = input<string>('');
  readonly ariaVerdict = input<string>('');
  readonly targetReached = input(false);
}

@Component({
  selector: 'pulpe-goal-contributions-list',
  template: '<div data-testid="stub-contributions"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalContributionsList {
  readonly contributions = input<unknown>([]);
  readonly currency = input<string>('CHF');
}

@Component({
  selector: 'pulpe-goal-withdrawals-list',
  template: '<div data-testid="stub-withdrawals"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalWithdrawalsList {
  readonly withdrawals = input<unknown>([]);
  readonly plannedWithdrawals = input<unknown>([]);
  readonly planOnlyWithdrawals = input<unknown>([]);
  readonly currency = input<string>('CHF');
  readonly isLoading = input(false);
  readonly hasError = input(false);
}

@Component({
  selector: 'pulpe-goal-plan-repair-callout',
  template: '<div data-testid="stub-repair-callout"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalPlanRepairCallout {
  readonly count = input(0);
  readonly isApplying = input(false);
  readonly previewRequested = output<void>();
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Vacances été 2027',
    startDate: null,
    targetAmount: 3000,
    targetDate: '2027-08-01',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as SavingsGoal;
}

function makeProgress(
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: 'goal-1',
    status: 'ACTIVE',
    startDate: null,
    targetAmount: 3000,
    targetDate: '2027-08-01',
    plannedCumulative: 1200,
    plannedProjection: 1200,
    confirmed: 900,
    initialAmount: 0,
    achievementPercent: 30,
    monthsElapsed: 3,
    monthsRemaining: 12,
    isOverdue: false,
    pace: 400,
    confirmedPace: 300,
    required: 175,
    projected: 4500,
    paceStatus: 'on_track',
    suggestCompletion: false,
    linkedLineCount: 2,
    cumulativeGap: 300,
    estimatedCompletion: { month: 6, year: 2027 },
    months: [],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

/**
 * Defaults to a *repairable* month (`hasBudget` and `isProvisionable` both true,
 * no linked line). Override them explicitly to exercise any other state.
 */
function makePlanMonth(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 8,
    year: 2026,
    state: 'gap',
    isLocked: false,
    isContributionEligible: true,
    hasBudget: true,
    isProvisionable: true,
    plannedAmount: 0,
    confirmedAmount: 0,
    plannedCumulative: 1200,
    confirmedCumulative: 900,
    lines: [],
    ...overrides,
  };
}

const futureLine: SavingsGoalFutureLine = {
  budgetLineId: 'line-1',
  amount: 250,
  month: 8,
  year: 2026,
};

const deletionCommand: SavingsGoalDeletionCommand = {
  mode: 'goal_only',
  revision: {
    templateLines: [],
    budgetLines: [],
    transactions: [],
  },
};

describe('SavingsGoalDetailPage', () => {
  let fixture: ComponentFixture<SavingsGoalDetailPage>;
  let component: SavingsGoalDetailPage;

  const goalSig = signal<SavingsGoal | null>(makeGoal());
  const progressSig = signal<SavingsGoalProgress | null>(makeProgress());
  const contributionsSig = signal<SavingsGoalContribution[]>([]);
  const progressErrorSig = signal<unknown>(null);
  const isProgressLoadingSig = signal(false);
  const isContributionsLoadingSig = signal(false);
  const listInitialLoadingSig = signal(false);
  const listErrorSig = signal<unknown>(null);
  const withdrawalsSig = signal<SavingsGoalWithdrawal[]>([]);
  const plannedWithdrawalsSig = signal<SavingsGoalPlannedWithdrawal[]>([]);
  const planOnlyWithdrawalsSig = signal<SavingsGoalPlanOnlyWithdrawal[]>([]);
  const isWithdrawalsLoadingSig = signal(false);
  const withdrawalsErrorSig = signal<unknown>(null);

  const completeGoal = vi.fn().mockResolvedValue(makeGoal());
  const reopenGoal = vi.fn().mockResolvedValue(makeGoal());
  const reloadProgress = vi.fn();
  const reloadWithdrawals = vi.fn();
  const refresh = vi.fn();
  const navigate = vi.fn();
  const snackBarOpen = vi.fn();
  const payDayOfMonthSig = signal<number | null>(25);
  const currencySig = signal<SupportedCurrency>('CHF');

  const futureLinesSig = signal<SavingsGoalFutureLine[]>([]);
  let deletionDialogResult: SavingsGoalDeletionCommand | undefined;
  const mockDialog = {
    open: vi.fn().mockImplementation(() => ({
      afterClosed: () => of(deletionDialogResult),
    })),
  };

  const mockStore = {
    selectedGoal: goalSig,
    progress: progressSig,
    progressError: progressErrorSig,
    isProgressLoading: isProgressLoadingSig,
    contributions: contributionsSig,
    isContributionsLoading: isContributionsLoadingSig,
    withdrawals: withdrawalsSig,
    plannedWithdrawals: plannedWithdrawalsSig,
    planOnlyWithdrawals: planOnlyWithdrawalsSig,
    isWithdrawalsLoading: isWithdrawalsLoadingSig,
    withdrawalsError: withdrawalsErrorSig,
    futureLines: futureLinesSig,
    savingsGoals: {
      isInitialLoading: listInitialLoadingSig,
      error: listErrorSig,
    },
    setSelectedGoalId: vi.fn(),
    reloadProgress,
    reloadWithdrawals,
    refresh,
    completeGoal,
    reopenGoal,
    editGoal: vi.fn().mockResolvedValue(makeGoal()),
    deleteGoal: vi.fn().mockResolvedValue(undefined),
    fetchFutureLines: vi.fn().mockResolvedValue([]),
    applyGenerationStop: vi.fn().mockResolvedValue({ affectedCount: 0 }),
    applyPlan: vi.fn().mockResolvedValue({}),
  };

  const mockDialogs = {
    openEdit: vi.fn(),
    openGenerationStop: vi.fn(),
    openApplyPlan: vi.fn(),
    confirmDiscardChanges: vi.fn(),
  };

  beforeEach(async () => {
    goalSig.set(makeGoal());
    progressSig.set(makeProgress());
    contributionsSig.set([]);
    progressErrorSig.set(null);
    isProgressLoadingSig.set(false);
    isContributionsLoadingSig.set(false);
    listInitialLoadingSig.set(false);
    listErrorSig.set(null);
    withdrawalsSig.set([]);
    plannedWithdrawalsSig.set([]);
    planOnlyWithdrawalsSig.set([]);
    isWithdrawalsLoadingSig.set(false);
    withdrawalsErrorSig.set(null);
    futureLinesSig.set([]);
    payDayOfMonthSig.set(25);
    currencySig.set('CHF');
    deletionDialogResult = undefined;
    vi.clearAllMocks();
    mockStore.editGoal.mockReset().mockResolvedValue(makeGoal());
    mockStore.fetchFutureLines.mockReset().mockResolvedValue([]);
    mockStore.applyGenerationStop
      .mockReset()
      .mockResolvedValue({ affectedCount: 0 });
    mockStore.applyPlan.mockReset().mockResolvedValue({});
    mockDialogs.openEdit.mockReset();
    mockDialogs.openGenerationStop.mockReset();
    mockDialogs.openApplyPlan.mockReset();
    mockDialogs.confirmDiscardChanges.mockReset();

    await TestBed.configureTestingModule({
      imports: [SavingsGoalDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: SavingsGoalStore, useValue: mockStore },
        { provide: SavingsGoalsDialogService, useValue: mockDialogs },
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: currencySig,
            payDayOfMonth: payDayOfMonthSig,
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
      ],
    })
      .overrideComponent(SavingsGoalDetailPage, {
        remove: {
          imports: [
            StateCard,
            BaseLoading,
            GoalProjectionChart,
            GoalPlanTimeline,
            GoalPlanSimulatorToolbar,
            GoalContributionsList,
            GoalWithdrawalsList,
            GoalPlanRepairCallout,
          ],
        },
        add: {
          imports: [
            StubGoalWithdrawalsList,
            StubStateCard,
            StubBaseLoading,
            StubGoalProjectionChart,
            StubGoalPlanTimeline,
            StubGoalPlanSimulatorToolbar,
            StubGoalContributionsList,
            StubGoalPlanRepairCallout,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SavingsGoalDetailPage);
    component = fixture.componentInstance;
    setTestInput(component.id, 'goal-1');
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  // The callout is stubbed — same isolation pattern as every other child
  // above — so the preview button doesn't exist in the page's own DOM:
  // simulate the child emitting its output instead of clicking through to
  // it. (Not Angular #54039: probed and ruled out, see the notes on
  // "offers a preview only for budgets that exist without a linked
  // forecast" below — the actual cause is a signal input on a
  // JIT-compiled child staying at its default under a parent template
  // binding, unrelated to a classic `@Input()`.)
  function triggerRepairPreview() {
    fixture.debugElement
      .query(By.directive(StubGoalPlanRepairCallout))
      .triggerEventHandler('previewRequested');
  }

  it('falls back on the net balance, not the gross plan, when the server has no projection', () => {
    // A goal with a target but no deadline: the server stops computing
    // `projected`, and `plannedProjection` sums contributions without ever
    // subtracting a withdrawal. The last `projectedCumulative` is the balance
    // the curve reaches, so the bar quotes it too: 2400/3000 = 80%, not
    // 3600/3000 clamped to 100%. iOS mirror:
    // `SavingsGoalProgress.displayedProjection`.
    progressSig.set(
      makeProgress({
        targetDate: null,
        projected: null,
        plannedProjection: 3600,
        months: [
          makePlanMonth({ month: 5, projectedCumulative: 2700 }),
          makePlanMonth({ month: 6, projectedCumulative: 2400 }),
        ],
      }),
    );
    fixture.detectChanges();

    expect(query('progress-projected-layer').nativeElement.style.width).toBe(
      '80%',
    );
  });

  it('renders the projected balance and confirmed layers from the progress response', () => {
    progressSig.set(makeProgress({ projected: 2400 }));
    fixture.detectChanges();

    const confirmed = query('progress-confirmed-layer');
    const projected = query('progress-projected-layer');
    expect(confirmed).toBeTruthy();
    expect(projected).toBeTruthy();
    // Confirmed layer uses the server-provided achievementPercent (30%).
    expect(confirmed.nativeElement.style.width).toBe('30%');
    expect(confirmed.nativeElement.classList).toContain('bg-financial-savings');
    // Projected balance layer uses the server endpoint: 2400/3000 = 80%.
    expect(projected.nativeElement.style.width).toBe('80%');
    expect(projected.nativeElement.classList).toContain('bg-tertiary');

    const bar = query('savings-goal-progress-bar');
    expect(bar.attributes['aria-valuenow']).toBe('30');
    expect(bar.attributes['aria-valuetext']).toContain('80');
    // « Épargné » labels the aggregate layer: it sums the never-pointed
    // initial amount with the checked lines, so « Pointé » would overclaim.
    expect(fixture.nativeElement.textContent).toContain('Épargné');
    expect(fixture.nativeElement.textContent).toContain(
      'Versements prévus jusqu’à maintenant',
    );
  });

  it('renders only applicable metrics for a name-only objective', () => {
    goalSig.set(
      makeGoal({
        startDate: null,
        targetAmount: null,
        targetDate: null,
      }),
    );
    progressSig.set(
      makeProgress({
        startDate: null,
        targetAmount: null,
        targetDate: null,
        plannedCumulative: 500,
        plannedProjection: 900,
        confirmed: 200,
        achievementPercent: null,
        monthsRemaining: null,
        required: null,
        projected: null,
        paceStatus: null,
        suggestCompletion: null,
        linkedLineCount: 0,
      }),
    );

    fixture.detectChanges();

    expect(query('savings-goal-empty-lines')).toBeTruthy();
    expect(query('stat-confirmed')).toBeTruthy();
    expect(query('stat-planned')).toBeTruthy();
    expect(query('stat-planned-projection')).toBeTruthy();
    expect(query('savings-goal-progress-bar')).toBeFalsy();
    expect(query('savings-goal-achievement')).toBeFalsy();
    expect(query('savings-goal-target-date')).toBeFalsy();
    expect(query('savings-goal-start-date')).toBeFalsy();
    expect(query('stat-required')).toBeFalsy();
    expect(query('stat-projected')).toBeFalsy();
    expect(query('savings-goal-pace-chip')).toBeFalsy();
    expect(query('savings-goal-suggest-completion')).toBeFalsy();
  });

  it('shows an estimated completion for a target without a deadline', () => {
    goalSig.set(makeGoal({ targetDate: null }));
    progressSig.set(
      makeProgress({
        targetDate: null,
        monthsRemaining: null,
        required: null,
        projected: null,
        paceStatus: null,
        estimatedCompletion: { month: 6, year: 2027 },
      }),
    );

    fixture.detectChanges();

    expect(query('savings-goal-progress-bar')).toBeTruthy();
    expect(query('stat-estimated-completion')).toBeTruthy();
    expect(query('stat-required')).toBeFalsy();
    expect(query('stat-projected')).toBeFalsy();
    expect(
      query('stat-planned-projection').query(
        By.css('[data-testid="stat-planned-projection-legend"]'),
      ),
    ).toBeTruthy();
    expect(query('savings-goal-pace-chip')).toBeFalsy();
  });

  it('renders start and deadline independently when present', () => {
    goalSig.set(
      makeGoal({
        startDate: '2026-06-01',
        targetAmount: null,
      }),
    );
    progressSig.set(
      makeProgress({
        startDate: '2026-06-01',
        targetAmount: null,
        achievementPercent: null,
        required: null,
        projected: null,
        paceStatus: null,
        suggestCompletion: null,
      }),
    );

    fixture.detectChanges();

    expect(query('savings-goal-start-date')).toBeTruthy();
    expect(query('savings-goal-target-date')).toBeTruthy();
    expect(query('savings-goal-progress-bar')).toBeFalsy();
  });

  it('shows the "Montant de départ" stat only when initialAmount > 0 (PUL-293)', () => {
    fixture.detectChanges();
    expect(query('stat-initial-amount')).toBeFalsy();

    progressSig.set(makeProgress({ initialAmount: 5000 }));
    fixture.detectChanges();

    const stat = query('stat-initial-amount');
    expect(stat).toBeTruthy();
    expect(stat.nativeElement.textContent).toContain('5');
  });

  it('formats the target and the initial amount without decimals, apostrophe-grouped (PUL-329)', () => {
    goalSig.set(makeGoal({ targetAmount: 12_345.6 }));
    progressSig.set(
      makeProgress({
        targetAmount: 12_345.6,
        initialAmount: 5000.6,
        achievementPercent: 30,
      }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12’346 CHF');
    const stat = query('stat-initial-amount');
    expect(stat.nativeElement.textContent).toContain('5’001 CHF');
  });

  it('shows the D1 overdue block + postpone CTA when isOverdue', () => {
    progressSig.set(
      makeProgress({ isOverdue: true, monthsRemaining: -1, required: null }),
    );
    fixture.detectChanges();

    expect(query('savings-goal-overdue-block')).toBeTruthy();
    expect(query('savings-goal-postpone-button')).toBeTruthy();
    // required is null when overdue → the stat is hidden.
    expect(query('stat-required')).toBeFalsy();
  });

  it('hides the D1 overdue block when the goal is completed', () => {
    goalSig.set(makeGoal({ status: 'COMPLETED' }));
    progressSig.set(
      makeProgress({
        status: 'COMPLETED',
        isOverdue: true,
        monthsRemaining: -1,
        required: null,
      }),
    );
    fixture.detectChanges();

    expect(query('savings-goal-overdue-block')).toBeFalsy();
  });

  it('shows the D2 suggestion and PATCHes COMPLETED on confirm', async () => {
    progressSig.set(makeProgress({ suggestCompletion: true }));
    fixture.detectChanges();

    expect(query('savings-goal-suggest-completion')).toBeTruthy();
    query('savings-goal-mark-completed-button').nativeElement.click();
    await Promise.resolve();

    expect(completeGoal).toHaveBeenCalledWith('goal-1');
  });

  it('shows « Ré-ouvrir » for a COMPLETED goal and reopens on click', async () => {
    goalSig.set(makeGoal({ status: 'COMPLETED' }));
    progressSig.set(makeProgress({ status: 'COMPLETED' }));
    fixture.detectChanges();

    const reopen = query('savings-goal-reopen-button');
    expect(reopen).toBeTruthy();
    reopen.nativeElement.click();
    await Promise.resolve();

    expect(reopenGoal).toHaveBeenCalledWith('goal-1');
  });

  it.each([
    {
      code: API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_CONFLICT,
      status: 409,
      expected:
        'Ces prévisions ont changé entre-temps — recharge la liste et réessaie',
    },
    {
      code: API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_LINE_INVALID,
      status: 422,
      expected:
        'Certaines prévisions ne sont plus liées à cet objectif — recharge la liste',
    },
    {
      code: API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED,
      status: 500,
      expected:
        "La décision a bien été enregistrée, mais les soldes n'ont pas pu être actualisés — recharge la page sans réessayer",
    },
  ])(
    'localizes generation-stop $status errors instead of exposing the server message',
    async ({ code, status, expected }) => {
      goalSig.set(makeGoal({ status: 'PAUSED' }));
      progressSig.set(makeProgress({ status: 'PAUSED' }));
      futureLinesSig.set([futureLine]);
      mockStore.fetchFutureLines.mockResolvedValueOnce([futureLine]);
      mockDialogs.openGenerationStop.mockResolvedValueOnce('freeze');
      mockStore.applyGenerationStop.mockRejectedValueOnce(
        new ApiError('Raw server message', code, status, null),
      );
      fixture.detectChanges();

      query('savings-goal-generation-stop-button').nativeElement.click();
      await fixture.whenStable();

      expect(snackBarOpen).toHaveBeenCalledWith(
        expected,
        'Fermer',
        expect.objectContaining({ duration: 5000 }),
      );
      expect(snackBarOpen).not.toHaveBeenCalledWith(
        'Raw server message',
        expect.anything(),
        expect.anything(),
      );
    },
  );

  it('shows a localized fallback when loading future lines fails', async () => {
    goalSig.set(makeGoal({ status: 'PAUSED' }));
    progressSig.set(makeProgress({ status: 'PAUSED' }));
    futureLinesSig.set([futureLine]);
    mockStore.fetchFutureLines.mockRejectedValueOnce(
      new ApiError('Server unavailable', undefined, 500, null),
    );
    fixture.detectChanges();

    query('savings-goal-generation-stop-button').nativeElement.click();
    await fixture.whenStable();

    expect(snackBarOpen).toHaveBeenCalledWith(
      'Une erreur est survenue — réessaie',
      'Fermer',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('keeps applying a generation-stop decision with the displayed line ids', async () => {
    goalSig.set(makeGoal({ status: 'PAUSED' }));
    progressSig.set(makeProgress({ status: 'PAUSED' }));
    futureLinesSig.set([futureLine]);
    mockStore.fetchFutureLines.mockResolvedValueOnce([futureLine]);
    mockDialogs.openGenerationStop.mockResolvedValueOnce('freeze');
    mockStore.applyGenerationStop.mockResolvedValueOnce({ affectedCount: 1 });
    fixture.detectChanges();

    query('savings-goal-generation-stop-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockStore.applyGenerationStop).toHaveBeenCalledWith('goal-1', {
      mode: 'freeze',
      budgetLineIds: ['line-1'],
    });
    expect(snackBarOpen).toHaveBeenCalledWith(
      '1 prévision(s) conservée(s) sans objectif.',
      'Fermer',
      { duration: 5000 },
    );
  });

  it('updates directly when an earlier ISO date stays in the same budget period', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    mockDialogs.openEdit.mockResolvedValueOnce({
      name: 'Même cycle',
      targetDate: '2027-08-25',
    });

    await component['onEdit']();

    expect(mockStore.fetchFutureLines).not.toHaveBeenCalled();
    expect(mockStore.editGoal).toHaveBeenCalledWith('goal-1', {
      name: 'Même cycle',
      targetDate: '2027-08-25',
    });
  });

  it('cancels a deadline reconciliation without any write', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    mockDialogs.openEdit.mockResolvedValueOnce({
      name: 'Nom conservé',
      targetDate: '2027-08-24',
    });
    mockStore.fetchFutureLines.mockResolvedValueOnce([futureLine]);
    mockDialogs.openGenerationStop.mockResolvedValueOnce(undefined);

    await component['onEdit']();

    expect(mockStore.fetchFutureLines).toHaveBeenCalledWith(
      'goal-1',
      '2027-08-24',
    );
    expect(mockDialogs.openGenerationStop).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [futureLine],
        context: { kind: 'deadline', targetDate: '2027-08-24' },
      }),
    );
    expect(mockStore.editGoal).not.toHaveBeenCalled();
    expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
  });

  it.each(['freeze', 'remove'] as const)(
    'applies deadline %s, then uses the remaining status candidates',
    async (mode) => {
      const remainingLine = { ...futureLine, budgetLineId: 'line-2' };
      goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
      const patch = {
        name: 'Vacances avancées',
        startDate: '2027-01-01',
        targetAmount: 2500,
        targetDate: '2027-08-24',
        status: 'PAUSED' as const,
      };
      mockDialogs.openEdit.mockResolvedValueOnce(patch);
      mockStore.fetchFutureLines
        .mockResolvedValueOnce([futureLine])
        .mockResolvedValueOnce([remainingLine]);
      mockDialogs.openGenerationStop
        .mockResolvedValueOnce(mode)
        .mockResolvedValueOnce('freeze');
      mockStore.applyGenerationStop.mockResolvedValueOnce({ affectedCount: 1 });

      await component['onEdit']();

      expect(mockStore.editGoal).toHaveBeenCalledOnce();
      expect(mockStore.editGoal).toHaveBeenCalledWith('goal-1', {
        ...patch,
        reconciliation: {
          mode,
          budgetLineIds: ['line-1'],
        },
      });
      expect(mockStore.fetchFutureLines).toHaveBeenNthCalledWith(2, 'goal-1');
      expect(mockDialogs.openGenerationStop).toHaveBeenLastCalledWith(
        expect.objectContaining({
          lines: [remainingLine],
          context: { kind: 'status', status: 'PAUSED' },
        }),
      );
      expect(mockStore.applyGenerationStop).toHaveBeenCalledWith('goal-1', {
        mode: 'freeze',
        budgetLineIds: ['line-2'],
      });
      expect(mockStore.editGoal.mock.invocationCallOrder[0]).toBeLessThan(
        mockStore.fetchFutureLines.mock.invocationCallOrder[1]!,
      );
    },
  );

  it('keeps the applied deadline patch when the status decision is dismissed', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    const patch = {
      targetDate: '2027-08-24',
      status: 'COMPLETED' as const,
    };
    mockDialogs.openEdit.mockResolvedValueOnce(patch);
    mockStore.fetchFutureLines
      .mockResolvedValueOnce([futureLine])
      .mockResolvedValueOnce([{ ...futureLine, budgetLineId: 'line-2' }]);
    mockDialogs.openGenerationStop
      .mockResolvedValueOnce('remove')
      .mockResolvedValueOnce(undefined);

    await component['onEdit']();

    expect(mockStore.editGoal).toHaveBeenCalledOnce();
    expect(mockStore.fetchFutureLines).toHaveBeenCalledTimes(2);
    expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
  });

  it('does not open a status dialog when no future line remains', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    mockDialogs.openEdit.mockResolvedValueOnce({
      targetDate: '2027-08-24',
      status: 'PAUSED',
    });
    mockStore.fetchFutureLines
      .mockResolvedValueOnce([futureLine])
      .mockResolvedValueOnce([]);
    mockDialogs.openGenerationStop.mockResolvedValueOnce('freeze');

    await component['onEdit']();

    expect(mockStore.editGoal).toHaveBeenCalledOnce();
    expect(mockStore.fetchFutureLines).toHaveBeenCalledTimes(2);
    expect(mockDialogs.openGenerationStop).toHaveBeenCalledOnce();
    expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
  });

  it('stops before any write or status decision when deadline preview fails', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    mockDialogs.openEdit.mockResolvedValueOnce({
      targetDate: '2027-08-24',
      status: 'PAUSED',
    });
    mockStore.fetchFutureLines.mockRejectedValueOnce(
      new ApiError('Unavailable', undefined, 500, null),
    );

    await component['onEdit']();

    expect(mockStore.fetchFutureLines).toHaveBeenCalledOnce();
    expect(mockStore.editGoal).not.toHaveBeenCalled();
    expect(mockDialogs.openGenerationStop).not.toHaveBeenCalled();
    expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
  });

  it('applies an earlier deadline directly when the preview is empty', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    const patch = { targetDate: '2027-08-24' };
    mockDialogs.openEdit.mockResolvedValueOnce(patch);
    mockStore.fetchFutureLines.mockResolvedValueOnce([]);

    await component['onEdit']();

    expect(mockStore.editGoal).toHaveBeenCalledWith('goal-1', patch);
    expect(mockDialogs.openGenerationStop).not.toHaveBeenCalled();
  });

  it.each([
    {
      current: null,
      update: '2027-08-24',
      label: 'adds a deadline to an undated goal',
    },
    {
      current: '2027-08-26',
      update: null,
      label: 'removes a deadline',
    },
    {
      current: '2027-08-26',
      update: '2027-09-26',
      label: 'moves a deadline later',
    },
  ])('$label without preview', async ({ current, update }) => {
    goalSig.set(makeGoal({ targetDate: current }));
    mockDialogs.openEdit.mockResolvedValueOnce({ targetDate: update });

    await component['onEdit']();

    expect(mockStore.fetchFutureLines).not.toHaveBeenCalled();
    expect(mockStore.editGoal).toHaveBeenCalledWith('goal-1', {
      targetDate: update,
    });
  });

  it.each([
    [
      API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_REQUIRED,
      'Cette nouvelle échéance laisse des prévisions au-delà — choisis comment les traiter',
    ],
    [
      API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_CONFLICT,
      'Les prévisions ont changé entre-temps — vérifie la nouvelle liste et réessaie',
    ],
  ])(
    'reloads, reopens, then sends one new PATCH after %s',
    async (code, localizedMessage) => {
      const refreshedLine = { ...futureLine, budgetLineId: 'line-2' };
      goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
      mockDialogs.openEdit.mockResolvedValueOnce({
        targetDate: '2027-08-24',
      });
      mockStore.fetchFutureLines
        .mockResolvedValueOnce([futureLine])
        .mockResolvedValueOnce([refreshedLine]);
      mockDialogs.openGenerationStop
        .mockResolvedValueOnce('freeze')
        .mockResolvedValueOnce('remove');
      mockStore.editGoal.mockRejectedValueOnce(
        new ApiError('Candidates drifted', code, 409, null),
      );

      await component['onEdit']();

      expect(mockStore.fetchFutureLines).toHaveBeenCalledTimes(2);
      expect(mockDialogs.openGenerationStop).toHaveBeenCalledTimes(2);
      expect(mockDialogs.openGenerationStop).toHaveBeenLastCalledWith(
        expect.objectContaining({ lines: [refreshedLine] }),
      );
      expect(mockStore.editGoal).toHaveBeenCalledTimes(2);
      expect(mockStore.editGoal).toHaveBeenLastCalledWith('goal-1', {
        targetDate: '2027-08-24',
        reconciliation: {
          mode: 'remove',
          budgetLineIds: ['line-2'],
        },
      });
      expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalledWith(
        localizedMessage,
        'Fermer',
        expect.objectContaining({ duration: 5000 }),
      );
    },
  );

  it('does not retry without a fresh reconciliation decision', async () => {
    goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
    mockDialogs.openEdit.mockResolvedValueOnce({
      targetDate: '2027-08-24',
    });
    mockStore.fetchFutureLines
      .mockResolvedValueOnce([futureLine])
      .mockResolvedValueOnce([]);
    mockDialogs.openGenerationStop.mockResolvedValueOnce('freeze');
    mockStore.editGoal.mockRejectedValueOnce(
      new ApiError(
        'Reconciliation required',
        API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_REQUIRED,
        409,
        null,
      ),
    );

    await component['onEdit']();

    expect(mockStore.fetchFutureLines).toHaveBeenCalledTimes(2);
    expect(mockDialogs.openGenerationStop).toHaveBeenCalledOnce();
    expect(mockStore.editGoal).toHaveBeenCalledOnce();
    expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
  });

  it.each([
    [
      API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_FAILED,
      "La mise à jour de l'échéance a échoué — réessaie",
    ],
    [
      API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED,
      "L'échéance et les prévisions ont bien été mises à jour, mais les soldes n'ont pas pu être actualisés — recharge la page sans réessayer",
    ],
  ])(
    'localizes %s without retry or false success',
    async (code, localizedMessage) => {
      goalSig.set(makeGoal({ targetDate: '2027-08-26' }));
      mockDialogs.openEdit.mockResolvedValueOnce({
        targetDate: '2027-08-24',
      });
      mockStore.fetchFutureLines.mockResolvedValueOnce([futureLine]);
      mockDialogs.openGenerationStop.mockResolvedValueOnce('remove');
      mockStore.editGoal.mockRejectedValueOnce(
        new ApiError('Server detail', code, 500, null),
      );

      await component['onEdit']();

      expect(mockStore.fetchFutureLines).toHaveBeenCalledOnce();
      expect(mockDialogs.openGenerationStop).toHaveBeenCalledOnce();
      expect(mockStore.editGoal).toHaveBeenCalledOnce();
      expect(mockStore.applyGenerationStop).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalledOnce();
      expect(snackBarOpen).toHaveBeenCalledWith(
        localizedMessage,
        'Fermer',
        expect.objectContaining({ duration: 5000 }),
      );
    },
  );

  it('hides the pace chip when paceStatus is null', () => {
    progressSig.set(makeProgress({ paceStatus: null }));
    fixture.detectChanges();
    expect(query('savings-goal-pace-chip')).toBeFalsy();
  });

  it('renders a neutral plan status with its projected amount when behind', () => {
    progressSig.set(makeProgress({ paceStatus: 'behind' }));
    fixture.detectChanges();
    const chip = query('savings-goal-pace-chip');
    expect(chip).toBeTruthy();
    expect(chip.nativeElement.textContent).toContain('En dessous de la cible');
    expect(
      query('stat-projected').nativeElement.contains(chip.nativeElement),
    ).toBe(true);
    const className = chip.nativeElement.className as string;
    expect(className).not.toContain('error');
    expect(className).not.toContain('amber');
    expect(className).not.toContain('warn');
  });

  it('shows the empty state when linkedLineCount is 0', () => {
    progressSig.set(makeProgress({ linkedLineCount: 0 }));
    fixture.detectChanges();
    // Flat guidance complements the applicable metrics and keeps edit available.
    expect(query('savings-goal-empty-lines')).toBeTruthy();
    expect(query('savings-goal-progress-bar')).toBeTruthy();
    expect(query('stat-confirmed')).toBeTruthy();
    expect(query('edit-savings-goal-button')).toBeTruthy();
  });

  it('offers a preview only for budgets that exist without a linked forecast', () => {
    progressSig.set(
      makeProgress({
        required: 175.345,
        months: [
          makePlanMonth({
            month: 7,
            hasBudget: false,
          }),
          makePlanMonth({ month: 8 }),
          makePlanMonth({
            month: 9,
            state: 'future',
            hasBudget: true,
            isProvisionable: false,
            plannedAmount: 250,
            lines: [
              {
                budgetLineId: '11111111-1111-4111-8111-111111111111',
                amount: 250,
                checkedAt: null,
                isManuallyAdjusted: false,
              },
            ],
          }),
        ],
      }),
    );

    fixture.detectChanges();

    // The stub's bound `count` input can't be read here. Verified on a
    // throwaway probe: a plain input(0) signal on a JIT-compiled child
    // stays at its default when set via a parent's [prop]="expr", with or
    // without .overrideComponent() on the host and with both a literal and
    // a property-reference binding — so it is NOT .overrideComponent()
    // recompiling the parent (both reproduce identically without it), and
    // NOT Angular #54039 (that's about a *required* input + computed()
    // evaluated before bindings apply; this child has neither). The same
    // probe with a classic @Input() decorator in place of input() DOES
    // receive the bound value, so the failure is specific to signal inputs
    // under JIT compilation; the deeper Angular-internals cause is not
    // identified beyond that. So the page-owned repairableMonths()
    // filtering (hasBudget / isProvisionable / existing line) is asserted
    // directly here, while the singular/plural wording driven by that count
    // is covered separately by GoalPlanRepairCallout's own spec
    // (goal-plan-repair-callout.spec.ts), which sets `count` directly via
    // setTestInput instead of a parent template binding.
    expect(component['repairableMonths']()).toHaveLength(1);
    // The host itself still renders — the DOM-observable half of the
    // guard (the page's `@if` lets the callout through when count > 0).
    expect(
      fixture.debugElement.query(By.directive(StubGoalPlanRepairCallout)),
    ).toBeTruthy();
  });

  it('does not offer recovery when every gap still lacks a budget', () => {
    progressSig.set(
      makeProgress({
        months: [makePlanMonth({ hasBudget: false })],
      }),
    );

    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.directive(StubGoalPlanRepairCallout)),
    ).toBeFalsy();
  });

  it('does not offer recovery when the goal is already covered', () => {
    progressSig.set(makeProgress({ required: 0, months: [makePlanMonth()] }));

    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.directive(StubGoalPlanRepairCallout)),
    ).toBeFalsy();
  });

  it('still offers recovery when not a single forecast is linked', () => {
    progressSig.set(
      makeProgress({ linkedLineCount: 0, months: [makePlanMonth()] }),
    );

    fixture.detectChanges();

    // The total-gap case is precisely what recovery exists for, so the plan
    // and its callout must survive the "no linked forecast" empty state.
    expect(query('savings-goal-plan')).toBeTruthy();
    expect(
      fixture.debugElement.query(By.directive(StubGoalPlanRepairCallout)),
    ).toBeTruthy();
  });

  it('previews and sends a positive sub-cent recovery as one cent', async () => {
    progressSig.set(
      makeProgress({ required: 0.004, months: [makePlanMonth()] }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(true);
    fixture.detectChanges();

    triggerRepairPreview();
    await fixture.whenStable();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          {
            month: 8,
            year: 2026,
            before: 0,
            after: 0.01,
          },
        ],
      }),
    );
    expect(mockStore.applyPlan).toHaveBeenCalledWith('goal-1', {
      monthAdjustments: [],
      missingMonthAdjustments: [{ month: 8, year: 2026, amount: 0.01 }],
    });
  });

  it('previews the rounded required amount and cancels without writing', async () => {
    progressSig.set(
      makeProgress({ required: 175.345, months: [makePlanMonth()] }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(false);
    fixture.detectChanges();

    triggerRepairPreview();
    await fixture.whenStable();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'creation',
        changes: [
          {
            month: 8,
            year: 2026,
            before: 0,
            after: 175.35,
          },
        ],
      }),
    );
    expect(mockStore.applyPlan).not.toHaveBeenCalled();
  });

  it('formats the recovery projection in CHF with the same apostrophe grouping as the dialog lines, no decimals', async () => {
    progressSig.set(
      makeProgress({ required: 175.345, months: [makePlanMonth()] }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(false);
    fixture.detectChanges();

    triggerRepairPreview();
    await fixture.whenStable();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'creation',
        verdict: 'Projection après création : 1’375 CHF',
      }),
    );
  });

  it('formats the recovery projection in EUR with the symbol in suffix position, no decimals', async () => {
    currencySig.set('EUR');
    progressSig.set(
      makeProgress({ required: 175.345, months: [makePlanMonth()] }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(false);
    fixture.detectChanges();

    triggerRepairPreview();
    await fixture.whenStable();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'creation',
        verdict: 'Projection après création : 1 375 €',
      }),
    );
  });

  it('creates all previewed forecasts then hides recovery after authoritative reload', async () => {
    progressSig.set(
      makeProgress({ required: 175.345, months: [makePlanMonth()] }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(true);
    mockStore.applyPlan.mockImplementationOnce(async () => {
      progressSig.set(
        makeProgress({
          required: 175.345,
          months: [
            makePlanMonth({
              state: 'future',
              isProvisionable: false,
              plannedAmount: 175.35,
              lines: [
                {
                  budgetLineId: '22222222-2222-4222-8222-222222222222',
                  amount: 175.35,
                  checkedAt: null,
                  isManuallyAdjusted: true,
                },
              ],
            }),
          ],
        }),
      );
      return {};
    });
    fixture.detectChanges();

    triggerRepairPreview();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockStore.applyPlan).toHaveBeenCalledWith('goal-1', {
      monthAdjustments: [],
      missingMonthAdjustments: [{ month: 8, year: 2026, amount: 175.35 }],
    });
    expect(
      fixture.debugElement.query(By.directive(StubGoalPlanRepairCallout)),
    ).toBeFalsy();
  });

  it('does not open a confirmation or announce success when the only simulated change is a zero-valued gap creation', async () => {
    progressSig.set(
      makeProgress({
        targetAmount: 500,
        initialAmount: 500,
        months: [makePlanMonth({ month: 7, plannedCumulative: 0 })],
      }),
    );
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].redistribute();
    await component['onApplyPlan']();

    expect(mockDialogs.openApplyPlan).not.toHaveBeenCalled();
    expect(mockStore.applyPlan).not.toHaveBeenCalled();
    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('previews and applies only the valid adjustment when a zero-valued gap creation is mixed in', async () => {
    const lineId = '11111111-1111-4111-8111-111111111111';
    progressSig.set(
      makeProgress({
        targetAmount: 500,
        initialAmount: 0,
        months: [
          makePlanMonth({
            month: 6,
            state: 'current',
            isProvisionable: false,
            plannedAmount: 200,
            plannedCumulative: 200,
            lines: [
              {
                budgetLineId: lineId,
                amount: 200,
                checkedAt: null,
                isManuallyAdjusted: false,
              },
            ],
          }),
          makePlanMonth({ month: 7, plannedCumulative: 200 }),
        ],
      }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(true);
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].setMonth(6, 2026, 500);
    component['simulator'].redistribute();
    await component['onApplyPlan']();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            month: 6,
            year: 2026,
            before: 200,
            after: 500,
          }),
        ],
      }),
    );
    expect(mockStore.applyPlan).toHaveBeenCalledWith('goal-1', {
      monthAdjustments: [{ budgetLineId: lineId, amount: 500 }],
      missingMonthAdjustments: [],
      planWithdrawalAdjustments: [],
    });
    expect(snackBarOpen).toHaveBeenCalled();
  });

  it('uses the reloaded withdrawal as the before value in the recap', async () => {
    const lineId = '11111111-1111-4111-8111-111111111111';
    progressSig.set(
      makeProgress({
        months: [
          makePlanMonth({
            month: 6,
            state: 'current',
            isProvisionable: false,
            plannedAmount: 1_260,
            confirmedAmount: 1_500,
            plannedWithdrawalAmount: 4_500,
            remainingPlannedWithdrawalAmount: 4_500,
            planLinkedWithdrawalAmount: 4_500,
            planWithdrawalDestination: 'linked_income',
            lines: [
              {
                budgetLineId: lineId,
                amount: 1_260,
                checkedAt: null,
                isManuallyAdjusted: false,
              },
            ],
          }),
        ],
      }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(false);
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].setMonth(6, 2026, -3_000);
    await component['onApplyPlan']();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            month: 6,
            year: 2026,
            before: -4_500,
            after: -3_000,
            contributionAmount: 1_500,
            planWithdrawalDestination: 'linked_income',
          }),
        ],
      }),
    );
  });

  it('applies a zero withdrawal deletion on a provisionable month without a saving line', async () => {
    progressSig.set(
      makeProgress({
        months: [
          makePlanMonth({
            month: 6,
            state: 'current',
            isProvisionable: true,
            hasBudget: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedWithdrawalAmount: 500,
            remainingPlannedWithdrawalAmount: 500,
            planOnlyWithdrawalAmount: 500,
            planWithdrawalDestination: 'goal_only',
            lines: [],
          }),
        ],
      }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(true);
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].setMonth(6, 2026, 0);
    await component['onApplyPlan']();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            month: 6,
            year: 2026,
            before: -500,
            after: 0,
          }),
        ],
      }),
    );
    expect(mockStore.applyPlan).toHaveBeenCalledWith('goal-1', {
      monthAdjustments: [],
      missingMonthAdjustments: [],
      planWithdrawalAdjustments: [
        {
          month: 6,
          year: 2026,
          amount: 0,
          destination: 'goal_only',
        },
      ],
    });
  });

  it('applies the withdrawal destination returned for its period', async () => {
    const lineId = '11111111-1111-4111-8111-111111111111';
    progressSig.set(
      makeProgress({
        months: [
          makePlanMonth({
            month: 6,
            state: 'current',
            isProvisionable: false,
            hasBudget: true,
            plannedAmount: 200,
            lines: [
              {
                budgetLineId: lineId,
                amount: 200,
                checkedAt: null,
                isManuallyAdjusted: false,
              },
            ],
          }),
        ],
      }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce([
      { month: 6, year: 2026, destination: 'linked_income' },
    ]);
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].setMonth(6, 2026, -500);
    await component['onApplyPlan']();

    expect(mockStore.applyPlan).toHaveBeenCalledWith('goal-1', {
      monthAdjustments: [],
      missingMonthAdjustments: [],
      planWithdrawalAdjustments: [
        {
          month: 6,
          year: 2026,
          amount: -500,
          destination: 'linked_income',
        },
      ],
    });
  });

  it('rebases on an exact plan conflict without allowing a stale retry', async () => {
    const lineId = '11111111-1111-4111-8111-111111111111';
    progressSig.set(
      makeProgress({
        months: [
          makePlanMonth({
            month: 6,
            state: 'current',
            isProvisionable: false,
            plannedAmount: 200,
            lines: [
              {
                budgetLineId: lineId,
                amount: 200,
                checkedAt: null,
                isManuallyAdjusted: false,
              },
            ],
          }),
        ],
      }),
    );
    mockDialogs.openApplyPlan.mockResolvedValueOnce(true);
    mockStore.applyPlan.mockRejectedValueOnce(
      new ApiError(
        'Stale plan',
        API_ERROR_CODES.SAVINGS_GOAL_PLAN_CONFLICT,
        409,
        null,
      ),
    );
    reloadProgress.mockImplementationOnce(() => isProgressLoadingSig.set(true));
    fixture.detectChanges();

    component['simulator'].enter();
    component['simulator'].setMonth(6, 2026, 500);
    await component['onApplyPlan']();

    expect(component['simulator'].isSimulating()).toBe(false);
    expect(component['simulator'].draft()).toBeNull();
    expect(component['simulator'].hasChanges()).toBe(false);
    fixture.detectChanges();
    expect(query('goal-plan-adjust-button')).toBeNull();
    expect(
      fixture.debugElement.query(By.directive(StubBaseLoading)),
    ).toBeTruthy();
    expect(reloadProgress).toHaveBeenCalledOnce();
    expect(reloadWithdrawals).toHaveBeenCalledOnce();
    expect(snackBarOpen).toHaveBeenCalledWith(
      'Le plan a changé entre-temps. Actualisation en cours — relance la simulation.',
      'Fermer',
      expect.objectContaining({ duration: 5000 }),
    );
    expect(snackBarOpen).not.toHaveBeenCalledWith(
      'Ton plan est à jour',
      expect.anything(),
      expect.anything(),
    );

    await component['onApplyPlan']();

    expect(mockDialogs.openApplyPlan).toHaveBeenCalledOnce();
    expect(mockStore.applyPlan).toHaveBeenCalledOnce();
  });

  it('deletes the goal with the preview revision then navigates back', async () => {
    deletionDialogResult = deletionCommand;
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockDialog.open).toHaveBeenCalledWith(GoalDeletionDialog, {
      data: {
        goalId: 'goal-1',
        goalName: 'Vacances été 2027',
        currency: 'CHF',
        locale: 'en-US',
        payDayOfMonth: 25,
      },
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90dvh',
      injector: expect.anything(),
    });
    expect(mockDialog.open.mock.calls[0][1]).not.toHaveProperty('height');
    expect(mockStore.deleteGoal).toHaveBeenCalledWith(
      'goal-1',
      deletionCommand,
    );
    expect(navigate).toHaveBeenCalledWith(['/', 'savings-goals']);
  });

  it('does not delete when the impact dialog is dismissed', async () => {
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockStore.deleteGoal).not.toHaveBeenCalled();
  });

  it('asks again on a fresh preview when the displayed impact changed', async () => {
    deletionDialogResult = deletionCommand;
    mockStore.deleteGoal.mockRejectedValueOnce(
      new ApiError(
        'Impact changed',
        API_ERROR_CODES.SAVINGS_GOAL_DELETION_IMPACT_CHANGED,
        409,
        null,
      ),
    );
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockDialog.open).toHaveBeenCalledTimes(2);
    expect(snackBarOpen).toHaveBeenCalledWith(
      'Les éléments rattachés ont changé entre-temps — vérifie le nouvel impact avant de confirmer',
      'Fermer',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('stays on the goal when the user backs out of the re-asked preview', async () => {
    deletionDialogResult = deletionCommand;
    mockDialog.open
      .mockImplementationOnce(() => ({
        afterClosed: () => of(deletionCommand),
      }))
      .mockImplementationOnce(() => ({ afterClosed: () => of(undefined) }));
    mockStore.deleteGoal.mockRejectedValueOnce(
      new ApiError(
        'Impact changed',
        API_ERROR_CODES.SAVINGS_GOAL_DELETION_IMPACT_CHANGED,
        409,
        null,
      ),
    );
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockStore.deleteGoal).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates after a committed deletion with recalculation failure', async () => {
    deletionDialogResult = deletionCommand;
    mockStore.deleteGoal.mockRejectedValueOnce(
      new ApiError(
        'Deletion committed',
        API_ERROR_CODES.SAVINGS_GOAL_DELETION_RECALCULATION_FAILED,
        500,
        null,
      ),
    );
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'savings-goals']);
    expect(snackBarOpen).toHaveBeenCalledWith(
      "L'objectif et les éléments choisis ont bien été supprimés, mais les soldes n'ont pas pu être actualisés — recharge les budgets sans relancer la suppression",
      'Fermer',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('shows the loading state while progress is loading', () => {
    isProgressLoadingSig.set(true);
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.directive(StubBaseLoading)),
    ).toBeTruthy();
  });

  it('shows the loading state while contributions are loading', () => {
    isContributionsLoadingSig.set(true);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.directive(StubBaseLoading)),
    ).toBeTruthy();
    expect(query('savings-goal-contributions')).toBeFalsy();
  });

  it('shows the error state (no progress body) when progress fails', () => {
    progressErrorSig.set(new Error('boom'));
    fixture.detectChanges();
    // Whole progress body is replaced — no header card, no bar.
    expect(
      fixture.debugElement.query(By.directive(StubStateCard)),
    ).toBeTruthy();
    expect(query('savings-goal-progress-bar')).toBeFalsy();
    expect(query('edit-savings-goal-button')).toBeFalsy();
  });

  it('shows an error instead of not-found when the goals list fails', () => {
    listErrorSig.set(new Error('list failed'));
    goalSig.set(null);
    progressSig.set(null);

    fixture.detectChanges();

    const stateCard = fixture.debugElement.query(By.directive(StubStateCard));
    expect(stateCard.componentInstance.variant()).toBe('error');
  });

  it('reloads both the goals list and progress from the error retry', () => {
    listErrorSig.set(new Error('list failed'));
    fixture.detectChanges();

    const errorCard = fixture.debugElement.query(By.directive(StubStateCard));
    errorCard.triggerEventHandler('action');

    expect(refresh).toHaveBeenCalledOnce();
    expect(reloadProgress).toHaveBeenCalledOnce();
  });

  it('hides the contributions section entirely when no line is linked', () => {
    progressSig.set(makeProgress({ linkedLineCount: 0 }));
    fixture.detectChanges();
    expect(query('savings-goal-contributions')).toBeFalsy();
  });

  it('navigates back to the list on back button', () => {
    fixture.detectChanges();
    query('savings-goal-back-button').nativeElement.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'savings-goals']);
  });

  describe('withdrawals section (PUL-329)', () => {
    const withdrawal: SavingsGoalWithdrawal = {
      transactionId: '00000000-0000-4000-8000-000000000200',
      budgetId: '00000000-0000-4000-8000-000000000100',
      name: 'Apport cuisine',
      transactionDate: '2026-07-20T10:00:00.000Z',
      amount: 800,
    };
    const plannedWithdrawal: SavingsGoalPlannedWithdrawal = {
      budgetLineId: '00000000-0000-4000-8000-000000000300',
      budgetId: '00000000-0000-4000-8000-000000000100',
      name: 'Apport cuisine',
      month: 9,
      year: 2026,
      plannedAmount: 4_500,
      realizedAmount: 0,
      remainingAmount: 4_500,
      status: 'planned',
    };

    it('stays hidden while the goal has never been drawn from', () => {
      fixture.detectChanges();
      expect(query('savings-goal-withdrawals')).toBeFalsy();
    });

    it('shows up beside the contributions once money went out', () => {
      withdrawalsSig.set([withdrawal]);
      fixture.detectChanges();

      const section = query('savings-goal-withdrawals');
      expect(section).toBeTruthy();
      expect(section.nativeElement.textContent).toContain('Retraits');
      expect(query('savings-goal-contributions')).toBeTruthy();
    });

    it('shows up as soon as a linked forecast announces a withdrawal', () => {
      plannedWithdrawalsSig.set([plannedWithdrawal]);
      fixture.detectChanges();

      expect(query('savings-goal-withdrawals')).toBeTruthy();
      expect(query('savings-goal-withdrawals')).toBeTruthy();
    });

    it('survives an empty history to carry its own loading and error states', () => {
      isWithdrawalsLoadingSig.set(true);
      fixture.detectChanges();
      expect(query('savings-goal-withdrawals')).toBeTruthy();

      isWithdrawalsLoadingSig.set(false);
      withdrawalsErrorSig.set(new Error('offline'));
      fixture.detectChanges();
      expect(query('savings-goal-withdrawals')).toBeTruthy();
    });
  });
});
