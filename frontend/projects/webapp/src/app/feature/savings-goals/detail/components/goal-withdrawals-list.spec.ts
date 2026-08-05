import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { SavingsGoalWithdrawal } from 'pulpe-shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { GoalWithdrawalsList } from './goal-withdrawals-list';

registerLocaleData(localeDE);

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

describe('GoalWithdrawalsList', () => {
  let fixture: ComponentFixture<GoalWithdrawalsList>;
  let component: GoalWithdrawalsList;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoalWithdrawalsList],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(GoalWithdrawalsList);
    component = fixture.componentInstance;
    setTestInput(component.currency, 'CHF');
    setTestInput(component.withdrawals, []);
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
});
