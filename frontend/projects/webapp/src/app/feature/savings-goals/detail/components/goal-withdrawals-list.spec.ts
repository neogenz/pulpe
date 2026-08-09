import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type {
  SavingsGoalPlanOnlyWithdrawal,
  SavingsGoalPlannedWithdrawal,
  SavingsGoalWithdrawal,
} from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { GoalWithdrawalsList } from './goal-withdrawals-list';

registerLocaleData(localeDE);
registerLocaleData(localeFrCH);

const BUDGET_ID = '00000000-0000-4000-8000-000000000100';
const TRANSACTION_ID = '00000000-0000-4000-8000-000000000200';

const withdrawal = (
  overrides: Partial<SavingsGoalWithdrawal> = {},
): SavingsGoalWithdrawal => ({
  transactionId: TRANSACTION_ID,
  budgetId: BUDGET_ID,
  name: 'Apport cuisine',
  transactionDate: '2026-07-20T10:00:00.000Z',
  amount: 800,
  ...overrides,
});

const plannedWithdrawal = (
  overrides: Partial<SavingsGoalPlannedWithdrawal> = {},
): SavingsGoalPlannedWithdrawal => ({
  budgetLineId: '00000000-0000-4000-8000-000000000300',
  budgetId: BUDGET_ID,
  name: 'Apport cuisine',
  month: 9,
  year: 2026,
  plannedAmount: 4_500,
  realizedAmount: 0,
  remainingAmount: 4_500,
  status: 'planned',
  ...overrides,
});

const planOnlyWithdrawal = (
  overrides: Partial<SavingsGoalPlanOnlyWithdrawal> = {},
): SavingsGoalPlanOnlyWithdrawal => ({
  planWithdrawalId: '00000000-0000-4000-8000-000000000400',
  name: 'Retrait ponctuel',
  month: 9,
  year: 2026,
  plannedAmount: 450,
  origin: 'plan_only',
  ...overrides,
});

describe('GoalWithdrawalsList', () => {
  let fixture: ComponentFixture<GoalWithdrawalsList>;
  let component: GoalWithdrawalsList;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoalWithdrawalsList],
      providers: [
        provideZonelessChangeDetection(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
        ...provideTranslocoForTest(),
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(GoalWithdrawalsList);
    component = fixture.componentInstance;
    setTestInput(component.currency, 'CHF');
    setTestInput(component.withdrawals, []);
    setTestInput(component.plannedWithdrawals, []);
    setTestInput(component.planOnlyWithdrawals, []);
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  it('shows each withdrawal as a negative amount without an error colour', () => {
    setTestInput(component.withdrawals, [withdrawal()]);
    fixture.detectChanges();

    const row = query('savings-goal-withdrawal-row');
    expect(row.nativeElement.textContent).toContain('-800.00 CHF');
    expect(row.nativeElement.className).not.toContain('error');
  });

  it('shows a linked forecast immediately in planned withdrawals', () => {
    setTestInput(component.plannedWithdrawals, [plannedWithdrawal()]);
    fixture.detectChanges();

    const row = query('savings-goal-planned-withdrawal-row');
    expect(
      query('savings-goal-withdrawals-panel').nativeElement.textContent,
    ).toContain('Retraits planifiés');
    expect(row.nativeElement.textContent).toContain('-4’500.00 CHF');
    expect(row.nativeElement.textContent).toContain('À réaliser');
  });

  it('shows a plan-only withdrawal as hors budget without navigation', () => {
    setTestInput(component.planOnlyWithdrawals, [planOnlyWithdrawal()]);
    fixture.detectChanges();

    const row = query('savings-goal-plan-only-withdrawal-row');
    expect(row.nativeElement.textContent).toContain('Hors budget');
    expect(row.nativeElement.textContent).toContain('-450.00 CHF');
    expect(row.nativeElement.querySelector('a')).toBeNull();
  });

  it('makes the remaining amount dominant for a partial realization', () => {
    setTestInput(component.plannedWithdrawals, [
      plannedWithdrawal({
        plannedAmount: 500,
        realizedAmount: 300,
        remainingAmount: 200,
        status: 'partially_realized',
      }),
    ]);
    fixture.detectChanges();

    const row = query('savings-goal-planned-withdrawal-row');
    expect(row.nativeElement.textContent).toMatch(/-200\.00 CHF\s+restant/);
    expect(row.nativeElement.textContent).toContain('Prévu 500.00 CHF');
    expect(row.nativeElement.textContent).toContain('Réalisé 300.00 CHF');
  });

  it('merges linked and out-of-budget forecasts in chronological order', () => {
    setTestInput(component.plannedWithdrawals, [
      plannedWithdrawal({ name: 'Octobre lié', month: 10 }),
    ]);
    setTestInput(component.planOnlyWithdrawals, [
      planOnlyWithdrawal({ name: 'Août hors budget', month: 8 }),
    ]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-planned-withdrawal-row]'),
    );
    expect(rows.map((row) => row.nativeElement.textContent)).toEqual([
      expect.stringContaining('Août hors budget'),
      expect.stringContaining('Octobre lié'),
    ]);
  });

  it('keeps the full financial context in the linked budget accessible name', () => {
    setTestInput(component.plannedWithdrawals, [
      plannedWithdrawal({
        plannedAmount: 500,
        realizedAmount: 300,
        remainingAmount: 200,
        status: 'partially_realized',
      }),
    ]);
    fixture.detectChanges();

    const ariaLabel = query('savings-goal-planned-withdrawal-row').attributes[
      'aria-label'
    ];
    expect(ariaLabel).toContain('Apport cuisine');
    expect(ariaLabel).toContain('septembre 2026');
    expect(ariaLabel).toContain('Partiellement réalisé');
    expect(ariaLabel).toContain('Prévu 500.00 CHF');
    expect(ariaLabel).toContain('réalisé 300.00 CHF');
    expect(ariaLabel).toContain('reste 200.00 CHF');
    expect(ariaLabel).toContain('Ouvrir ce budget');
  });

  it('separates realized transactions and exposes their pointing state', () => {
    setTestInput(component.withdrawals, [
      withdrawal({ checkedAt: '2026-07-20T10:00:00.000Z' }),
      withdrawal({
        transactionId: '00000000-0000-4000-8000-000000000201',
        checkedAt: null,
      }),
    ]);
    fixture.detectChanges();

    const panel = query('savings-goal-withdrawals-panel');
    expect(panel.nativeElement.textContent).toContain('Retraits réalisés');
    expect(panel.nativeElement.textContent).toContain('Pointé');
    expect(panel.nativeElement.textContent).toContain('À pointer');
  });

  it('keeps the server order and links to the budget, never to a targeted transaction', () => {
    setTestInput(component.withdrawals, [
      withdrawal({ name: 'Le plus récent' }),
      withdrawal({
        transactionId: '00000000-0000-4000-8000-000000000201',
        name: 'Le plus ancien',
        transactionDate: '2026-05-02T10:00:00.000Z',
      }),
    ]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-withdrawal-row"]'),
    );
    expect(rows[0].nativeElement.textContent).toContain('Le plus récent');
    expect(rows[0].nativeElement.getAttribute('href')).toBe(
      `/budget/${BUDGET_ID}`,
    );
    expect(rows[0].attributes['aria-label']).toContain('Le plus récent');
  });

  it('reports loading, error and empty independently of each other', () => {
    setTestInput(component.isLoading, true);
    fixture.detectChanges();
    expect(query('goal-withdrawals-loading')).toBeTruthy();
    expect(query('goal-withdrawals-empty')).toBeNull();

    setTestInput(component.isLoading, false);
    setTestInput(component.hasError, true);
    fixture.detectChanges();
    expect(query('goal-withdrawals-error').attributes['role']).toBe('alert');
    expect(query('goal-withdrawals-empty')).toBeNull();

    setTestInput(component.hasError, false);
    fixture.detectChanges();
    expect(query('goal-withdrawals-empty')).toBeTruthy();
  });

  it('offers a real retry action when loading fails', () => {
    const retry = vi.fn();
    component.retryRequested.subscribe(retry);
    setTestInput(component.hasError, true);
    fixture.detectChanges();

    query('goal-withdrawals-retry').nativeElement.click();

    expect(retry).toHaveBeenCalledOnce();
  });
});
