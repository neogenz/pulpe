import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { UserSettingsStore } from '@core/user-settings';
import { format } from 'date-fns';
import { suggestedMonthlyContribution } from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavingsGoalFormDialog } from './savings-goal-form-dialog';

const ISO_DATE = 'yyyy-MM-dd';

function futureDate(months: number): string {
  const now = new Date();
  return format(
    new Date(now.getFullYear(), now.getMonth() + months, 15),
    ISO_DATE,
  );
}

describe('SavingsGoalFormDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('anchors the suggested contribution on a future start date', () => {
    TestBed.configureTestingModule({
      imports: [SavingsGoalFormDialog],
      providers: [
        provideZonelessChangeDetection(),
        provideNativeDateAdapter(),
        ...provideTranslocoForTest(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal('CHF' as const),
            payDayOfMonth: signal(null),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SavingsGoalFormDialog);
    fixture.detectChanges();
    const startDate = futureDate(3);
    const targetDate = futureDate(5);

    const input = (testId: string) =>
      fixture.nativeElement.querySelector(
        `[data-testid="${testId}"]`,
      ) as HTMLInputElement;
    const change = (testId: string, value: string) => {
      const element = input(testId);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    };
    const changeDate = (testId: string, value: string) => {
      change(testId, value);
      input(testId).dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
    };

    change('savings-goal-name', 'Projet futur');
    change('savings-goal-target-amount', '1200');
    changeDate('savings-goal-target-date', targetDate);
    changeDate('savings-goal-start-date', startDate);

    const renderedContribution = input('savings-goal-monthly-contribution');
    expect(Number(renderedContribution.value)).toBe(
      suggestedMonthlyContribution({
        targetAmount: 1200,
        startDate,
        targetDate,
        payDayOfMonth: null,
      }),
    );
  });
});
