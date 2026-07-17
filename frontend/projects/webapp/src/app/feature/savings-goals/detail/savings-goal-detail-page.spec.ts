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
import { MatSnackBar } from '@angular/material/snack-bar';
import localeDE from '@angular/common/locales/de-CH';
import {
  API_ERROR_CODES,
  type SavingsGoal,
  type SavingsGoalContribution,
  type SavingsGoalFutureLine,
  type SavingsGoalProgress,
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
  readonly targetAmount = input<number>(0);
  readonly currency = input<string>('CHF');
  readonly confirmedPace = input<number>(0);
}

@Component({
  selector: 'pulpe-goal-plan-timeline',
  template: '<div data-testid="stub-timeline"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGoalPlanTimeline {
  readonly months = input<unknown>();
  readonly simulatedMonths = input<unknown>(null);
  readonly currency = input<string>('CHF');
  readonly locale = input<string>('fr-CH');
  readonly payDayOfMonth = input<number | null>(null);
  readonly editable = input<boolean>(false);
  readonly expanded = input<boolean>(false);
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

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Vacances été 2027',
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
    targetAmount: 3000,
    targetDate: '2027-08-01',
    plannedCumulative: 1200,
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

const futureLine: SavingsGoalFutureLine = {
  budgetLineId: 'line-1',
  amount: 250,
  month: 8,
  year: 2026,
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

  const completeGoal = vi.fn().mockResolvedValue(makeGoal());
  const reopenGoal = vi.fn().mockResolvedValue(makeGoal());
  const reloadProgress = vi.fn();
  const refresh = vi.fn();
  const navigate = vi.fn();
  const snackBarOpen = vi.fn();

  const futureLinesSig = signal<SavingsGoalFutureLine[]>([]);

  const mockStore = {
    selectedGoal: goalSig,
    progress: progressSig,
    progressError: progressErrorSig,
    isProgressLoading: isProgressLoadingSig,
    contributions: contributionsSig,
    isContributionsLoading: isContributionsLoadingSig,
    futureLines: futureLinesSig,
    savingsGoals: {
      isInitialLoading: listInitialLoadingSig,
      error: listErrorSig,
    },
    setSelectedGoalId: vi.fn(),
    reloadProgress,
    refresh,
    completeGoal,
    reopenGoal,
    editGoal: vi.fn().mockResolvedValue(makeGoal()),
    removeGoal: vi.fn().mockResolvedValue(undefined),
    fetchFutureLines: vi.fn().mockResolvedValue([]),
    applyGenerationStop: vi.fn().mockResolvedValue({ affectedCount: 0 }),
  };

  const mockDialogs = {
    openEdit: vi.fn(),
    openGenerationStop: vi.fn(),
    confirmDelete: vi.fn(),
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
    futureLinesSig.set([]);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [SavingsGoalDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: SavingsGoalStore, useValue: mockStore },
        { provide: SavingsGoalsDialogService, useValue: mockDialogs },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF'), payDayOfMonth: signal(25) },
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
          ],
        },
        add: {
          imports: [
            StubStateCard,
            StubBaseLoading,
            StubGoalProjectionChart,
            StubGoalPlanTimeline,
            StubGoalPlanSimulatorToolbar,
            StubGoalContributionsList,
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

  it('renders the two prévu/confirmé layers from the progress response', () => {
    fixture.detectChanges();

    const confirmed = query('progress-confirmed-layer');
    const planned = query('progress-planned-layer');
    expect(confirmed).toBeTruthy();
    expect(planned).toBeTruthy();
    // Confirmed layer uses the server-provided achievementPercent (30%).
    expect(confirmed.nativeElement.style.width).toBe('30%');
    // Planned layer is a display ratio 1200/3000 = 40%.
    expect(planned.nativeElement.style.width).toBe('40%');

    const bar = query('savings-goal-progress-bar');
    expect(bar.attributes['aria-valuenow']).toBe('30');
    // « Pointé » vocabulary is present (legend + stat label).
    expect(fixture.nativeElement.textContent).toContain('Pointé');
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

  it('hides the pace chip when paceStatus is null', () => {
    progressSig.set(makeProgress({ paceStatus: null }));
    fixture.detectChanges();
    expect(query('savings-goal-pace-chip')).toBeFalsy();
  });

  it('renders a neutral pace chip when behind (never red/amber)', () => {
    progressSig.set(makeProgress({ paceStatus: 'behind' }));
    fixture.detectChanges();
    const chip = query('savings-goal-pace-chip');
    expect(chip).toBeTruthy();
    const className = chip.nativeElement.className as string;
    expect(className).not.toContain('error');
    expect(className).not.toContain('amber');
    expect(className).not.toContain('warn');
  });

  it('shows the empty state when linkedLineCount is 0', () => {
    progressSig.set(makeProgress({ linkedLineCount: 0 }));
    fixture.detectChanges();
    // Flat guidance replaces the bar/stats, but the header (edit) still renders.
    expect(query('savings-goal-empty-lines')).toBeTruthy();
    expect(query('savings-goal-progress-bar')).toBeFalsy();
    expect(query('stat-confirmed')).toBeFalsy();
    expect(query('edit-savings-goal-button')).toBeTruthy();
  });

  it('deletes the goal after confirmation and navigates back to the list', async () => {
    mockDialogs.confirmDelete.mockResolvedValue(true);
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockStore.removeGoal).toHaveBeenCalledWith('goal-1');
    expect(navigate).toHaveBeenCalledWith(['/', 'savings-goals']);
  });

  it('does not delete when the confirmation is declined', async () => {
    mockDialogs.confirmDelete.mockResolvedValue(false);
    fixture.detectChanges();

    query('delete-savings-goal-button').nativeElement.click();
    await fixture.whenStable();

    expect(mockStore.removeGoal).not.toHaveBeenCalled();
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
});
