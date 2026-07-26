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
    const component = TestBed.createComponent(
      SavingsGoalFormDialog,
    ).componentInstance;
    const startDate = futureDate(3);
    const targetDate = futureDate(5);

    component['model'].set({
      name: 'Projet futur',
      startDate,
      targetAmount: '1200',
      initialAmount: '',
      targetDate,
      status: 'ACTIVE',
    });

    expect(component['monthlyContribution']()).toBe(
      suggestedMonthlyContribution({
        targetAmount: 1200,
        startDate,
        targetDate,
        payDayOfMonth: null,
      }),
    );
  });
});
