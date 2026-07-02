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
import localeDE from '@angular/common/locales/de-CH';
import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalProgress,
} from 'pulpe-shared';
import SavingsGoalDetailPage from './savings-goal-detail-page';
import { SavingsGoalStore } from '../services/savings-goals-store';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';
import { UserSettingsStore } from '@core/user-settings';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
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
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

function makeContribution(
  overrides: Partial<SavingsGoalContribution> = {},
): SavingsGoalContribution {
  return {
    lineId: 'line-1',
    name: 'Épargne mensuelle',
    amount: 500,
    checkedAt: null,
    budgetMonth: 7,
    budgetYear: 2026,
    transactions: [],
    ...overrides,
  };
}

describe('SavingsGoalDetailPage', () => {
  let fixture: ComponentFixture<SavingsGoalDetailPage>;
  let component: SavingsGoalDetailPage;

  const goalSig = signal<SavingsGoal | null>(makeGoal());
  const progressSig = signal<SavingsGoalProgress | null>(makeProgress());
  const contributionsSig = signal<SavingsGoalContribution[]>([]);
  const progressErrorSig = signal<unknown>(null);
  const isProgressLoadingSig = signal(false);
  const listInitialLoadingSig = signal(false);

  const completeGoal = vi.fn().mockResolvedValue(makeGoal());
  const reopenGoal = vi.fn().mockResolvedValue(makeGoal());
  const reloadProgress = vi.fn();
  const navigate = vi.fn();

  const mockStore = {
    selectedGoal: goalSig,
    progress: progressSig,
    progressError: progressErrorSig,
    isProgressLoading: isProgressLoadingSig,
    contributions: contributionsSig,
    isContributionsLoading: signal(false),
    savingsGoals: { isInitialLoading: listInitialLoadingSig },
    setSelectedGoalId: vi.fn(),
    reloadProgress,
    completeGoal,
    reopenGoal,
    editGoal: vi.fn().mockResolvedValue(makeGoal()),
    removeGoal: vi.fn().mockResolvedValue(undefined),
  };

  const mockDialogs = {
    openEdit: vi.fn(),
    confirmDelete: vi.fn(),
  };

  beforeEach(async () => {
    goalSig.set(makeGoal());
    progressSig.set(makeProgress());
    contributionsSig.set([]);
    progressErrorSig.set(null);
    isProgressLoadingSig.set(false);
    listInitialLoadingSig.set(false);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [SavingsGoalDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: SavingsGoalStore, useValue: mockStore },
        { provide: SavingsGoalsDialogService, useValue: mockDialogs },
        { provide: UserSettingsStore, useValue: { currency: signal('CHF') } },
        { provide: Router, useValue: { navigate } },
      ],
    })
      .overrideComponent(SavingsGoalDetailPage, {
        remove: { imports: [StateCard, BaseLoading] },
        add: { imports: [StubStateCard, StubBaseLoading] },
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

  it('lists one contribution per linked line, checked prévision included even without transaction', () => {
    contributionsSig.set([
      makeContribution({ checkedAt: '2026-07-02T18:00:00.000Z' }),
      makeContribution({ lineId: 'line-2', budgetMonth: 8 }),
    ]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-contribution-row"]'),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].nativeElement.textContent).toContain('Épargne mensuelle');
    expect(rows[0].nativeElement.textContent).toContain('500.00');
  });

  it('nests the allocated transactions under their contribution', () => {
    contributionsSig.set([
      makeContribution({
        transactions: [
          {
            id: 'tx-1',
            budgetId: 'budget-1',
            budgetLineId: 'line-1',
            name: 'macbook1',
            amount: 150,
            kind: 'saving',
            transactionDate: '2026-07-02T10:00:00.000Z',
            checkedAt: '2026-07-02T10:00:00.000Z',
            category: null,
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z',
            originalAmount: null,
            originalCurrency: null,
            targetCurrency: null,
            exchangeRate: null,
          },
        ],
      }),
    ]);
    fixture.detectChanges();

    const nested = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-contribution-transaction"]'),
    );
    expect(nested).toHaveLength(1);
    expect(nested[0].nativeElement.textContent).toContain('macbook1');
    expect(nested[0].nativeElement.textContent).toContain('150.00');
    // The inset block is labeled « Réel » so the envelope/transaction
    // relationship reads at a glance.
    const row = query('savings-goal-contribution-row');
    expect(row.nativeElement.textContent).toContain('Réel');
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
