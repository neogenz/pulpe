import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatSelect, type MatSelectChange } from '@angular/material/select';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetPeriod, SavingsGoal } from 'pulpe-shared';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { SavingsGoalPickerField } from './savings-goal-picker-field';
import { createMockDataCache } from '@core/testing';

const mockCache = createMockDataCache();

const goal = {
  id: 'goal-1',
  name: 'Vacances',
  userId: 'user-1',
  targetAmount: 3_000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as SavingsGoal;

const goalWithDeadline = (targetDate: string | null): SavingsGoal =>
  ({ ...goal, targetDate }) as SavingsGoal;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** Drives the very output the template listens to, so the pick counts as the user's. */
const pickInSelect = (
  fixture: ComponentFixture<SavingsGoalPickerField>,
  goalId: string | null,
): void =>
  fixture.debugElement
    .query(By.directive(MatSelect))
    .componentInstance.selectionChange.emit({
      value: goalId,
    } as MatSelectChange);

describe('SavingsGoalPickerField', () => {
  const getAll$ = vi.fn();
  const getWithdrawalOptions$ = vi.fn();
  const payDayOfMonth = signal<number | null>(1);

  beforeEach(async () => {
    getAll$.mockReset();
    getWithdrawalOptions$.mockReset();
    payDayOfMonth.set(1);
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockCache.deduplicate.mockImplementation(
      (_key: string[], fn: () => Promise<unknown>) => fn(),
    );

    await TestBed.configureTestingModule({
      imports: [SavingsGoalPickerField],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        {
          provide: SavingsGoalApi,
          useValue: {
            cache: mockCache,
            getAll$,
            getWithdrawalOptions$,
          },
        },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF'), payDayOfMonth },
        },
      ],
    }).compileComponents();
  });

  it('renders loading, error with retry, then successful empty distinctly', async () => {
    const initialRequest = new Subject<unknown>();
    getAll$
      .mockReturnValueOnce(initialRequest.asObservable())
      .mockReturnValueOnce(of({ data: [], success: true }));
    const fixture = TestBed.createComponent(SavingsGoalPickerField);

    fixture.detectChanges();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-loading"]'),
      ),
    ).toBeTruthy();

    initialRequest.error(new Error('network'));
    await settle();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-error"]'),
      ),
    ).toBeTruthy();

    fixture.debugElement
      .query(By.css('[data-testid="savings-goal-picker-retry"]'))
      .nativeElement.click();
    await settle();
    fixture.detectChanges();

    expect(getAll$).toHaveBeenCalledTimes(2);
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-empty"]'),
      ),
    ).toBeTruthy();
  });

  it('reconciles a missing value only after a successful load', async () => {
    getAll$
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of({ data: [goal], success: true }));
    const fixture = TestBed.createComponent(SavingsGoalPickerField);
    setTestInput(fixture.componentInstance.value, 'deleted-goal');
    const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');

    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(emitted).not.toHaveBeenCalled();

    fixture.debugElement
      .query(By.css('[data-testid="savings-goal-picker-retry"]'))
      .nativeElement.click();
    await settle();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(getAll$).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveBeenCalledOnce();
    expect(emitted).toHaveBeenCalledWith(null);
  });

  // PUL-313 — the picker must not offer a link the enforce_savings_goal_line_link
  // trigger would reject with a 422.
  describe('goal horizon', () => {
    // Returns the rendered goal option (the "Aucun objectif" entry comes first).
    const openAndReadGoalOption = async (
      goals: SavingsGoal[],
      budgetPeriod: BudgetPeriod | null,
    ): Promise<HTMLElement> => {
      getAll$.mockReturnValue(of({ data: goals, success: true }));
      const fixture = TestBed.createComponent(SavingsGoalPickerField);
      setTestInput(fixture.componentInstance.budgetPeriod, budgetPeriod);

      fixture.detectChanges();
      await settle();
      fixture.detectChanges();

      const trigger = fixture.nativeElement.querySelector(
        '.mat-mdc-select-trigger',
      ) as HTMLElement;
      trigger.click();
      fixture.detectChanges();
      await settle();

      const option = document.querySelector(
        `.cdk-overlay-container [data-testid="savings-goal-picker-option-${goals[0].id}"]`,
      );
      return option as HTMLElement;
    };

    it('lists a goal whose deadline precedes the budget period, but disables it with the deadline as reason', async () => {
      const option = await openAndReadGoalOption(
        [goalWithDeadline('2027-08-01')],
        {
          month: 9,
          year: 2027,
        },
      );

      expect(option.textContent).toContain('Vacances');
      expect(option.getAttribute('aria-disabled')).toBe('true');
      expect(option.textContent).toContain('août 2027');
    });

    it('keeps a goal selectable when its deadline is at or after the budget period', async () => {
      const option = await openAndReadGoalOption(
        [goalWithDeadline('2027-08-01')],
        {
          month: 8,
          year: 2027,
        },
      );

      expect(option.getAttribute('aria-disabled')).toBe('false');
    });

    it('keeps an undated goal selectable — it has no horizon to fall outside of', async () => {
      const option = await openAndReadGoalOption([goalWithDeadline(null)], {
        month: 12,
        year: 2030,
      });

      expect(option.getAttribute('aria-disabled')).toBe('false');
    });

    it('disables nothing when no budget period is supplied (template lines)', async () => {
      const option = await openAndReadGoalOption(
        [goalWithDeadline('2027-08-01')],
        null,
      );

      expect(option.getAttribute('aria-disabled')).toBe('false');
    });

    // 28 August straddles the pay cycle: on payDay 1 it belongs to the August
    // period, on payDay 27 it opens the September one (règle quinzaine). The
    // same goal must therefore flip state on a September budget.
    it('puts a deadline late in the month out of horizon on a calendar pay day', async () => {
      const option = await openAndReadGoalOption(
        [goalWithDeadline('2027-08-28')],
        { month: 9, year: 2027 },
      );

      expect(option.getAttribute('aria-disabled')).toBe('true');
    });

    // Disabling the option only guards a goal picked AFTER the period is known.
    // A spread range widened later moves the period past an already-linked goal.
    it('clears a goal picked here once the period widens past its deadline', async () => {
      getAll$.mockReturnValue(
        of({ data: [goalWithDeadline('2026-06-15')], success: true }),
      );
      const fixture = TestBed.createComponent(SavingsGoalPickerField);
      setTestInput(fixture.componentInstance.budgetPeriod, {
        month: 6,
        year: 2026,
      });
      const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');

      fixture.detectChanges();
      await settle();
      fixture.detectChanges();

      pickInSelect(fixture, goal.id);
      setTestInput(fixture.componentInstance.value, goal.id);
      fixture.detectChanges();
      TestBed.flushEffects();
      expect(emitted).toHaveBeenCalledExactlyOnceWith(goal.id);

      setTestInput(fixture.componentInstance.budgetPeriod, {
        month: 11,
        year: 2026,
      });
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(emitted).toHaveBeenLastCalledWith(null);
    });

    // An edit surface opens carrying a link saved while it was still valid.
    // Withdrawing it on open would edit the user's data without them asking.
    it('keeps a link it was opened with even when out of horizon', async () => {
      getAll$.mockReturnValue(
        of({ data: [goalWithDeadline('2026-06-15')], success: true }),
      );
      const fixture = TestBed.createComponent(SavingsGoalPickerField);
      setTestInput(fixture.componentInstance.value, goal.id);
      setTestInput(fixture.componentInstance.budgetPeriod, {
        month: 11,
        year: 2026,
      });
      const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');

      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(emitted).not.toHaveBeenCalled();
    });

    it('keeps that same deadline in horizon once the pay day moves it forward', async () => {
      payDayOfMonth.set(27);

      const option = await openAndReadGoalOption(
        [goalWithDeadline('2027-08-28')],
        { month: 9, year: 2027 },
      );

      expect(option.getAttribute('aria-disabled')).toBe('false');
    });
  });

  // PUL-329 — the pre-check must open the same band as the server, which accepts
  // `debit <= available + WITHDRAWAL_BALANCE_TOLERANCE`. The balance arrives as a
  // server-side SUM of floats, so emptying a goal lands a hair under zero.
  describe('withdrawal balance', () => {
    const withdrawalPicker = async (
      availableAmount: number,
      withdrawalAmount: number,
    ): Promise<ComponentFixture<SavingsGoalPickerField>> => {
      getWithdrawalOptions$.mockReturnValue(
        of({
          success: true,
          data: [
            {
              goalId: goal.id,
              name: goal.name,
              status: 'ACTIVE',
              availableAmount,
              currency: 'CHF',
            },
          ],
        }),
      );
      const fixture = TestBed.createComponent(SavingsGoalPickerField);
      setTestInput(fixture.componentInstance.mode, 'withdrawal');
      setTestInput(fixture.componentInstance.value, goal.id);
      setTestInput(
        fixture.componentInstance.withdrawalAmount,
        withdrawalAmount,
      );

      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      return fixture;
    };

    it('still allows emptying a goal whose balance rounds a hair under the amount', async () => {
      const fixture = await withdrawalPicker(149.999, 150);

      expect(fixture.componentInstance.hasInsufficientBalance()).toBe(false);
      expect(fixture.componentInstance.isWithdrawalBlocked()).toBe(false);
    });

    it('blocks an overshoot the server would refuse', async () => {
      const fixture = await withdrawalPicker(150, 150.01);
      expect(fixture.componentInstance.hasInsufficientBalance()).toBe(true);
      expect(fixture.componentInstance.isWithdrawalBlocked()).toBe(true);
    });

    // Funded goals exist, none is picked, and the submit button is greyed out.
    // Every other blocked state here names its reason; this one left the user
    // staring at a dead button.
    it('says why the submit is blocked while no goal is picked', async () => {
      const fixture = await withdrawalPicker(150, 100);
      setTestInput(fixture.componentInstance.value, null);
      fixture.detectChanges();

      expect(fixture.componentInstance.isWithdrawalBlocked()).toBe(true);
      const hint = fixture.debugElement.query(
        By.css('[data-testid="savings-goal-withdrawal-required"]'),
      );
      expect(hint).toBeTruthy();
      expect(
        fixture.debugElement.query(
          By.css('[data-testid="savings-goal-withdrawal-select"]'),
        ).attributes['required'],
      ).toBeDefined();
    });
  });
});
