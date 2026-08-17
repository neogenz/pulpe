import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CurrencyConverterService, StaleRateNotifier } from '@core/currency';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type { SupportedCurrency, SupportedLocale } from 'pulpe-shared';
import { describe, expect, it, vi } from 'vitest';
import {
  SavingsWithdrawalDialog,
  type SavingsWithdrawalDialogData,
} from './dialog';

function createDialog(currency: SupportedCurrency, deficitAmount = 0.3) {
  TestBed.resetTestingModule();
  const close = vi.fn();
  const convertWithMetadata = vi
    .fn()
    .mockImplementation(async (amount: number) => ({
      convertedAmount: amount,
      metadata: null,
    }));

  TestBed.configureTestingModule({
    imports: [SavingsWithdrawalDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          budgetId: '00000000-0000-4000-8000-000000000123',
          budgetMonth: 8,
          budgetYear: 2026,
          deficitAmount,
        } satisfies SavingsWithdrawalDialogData,
      },
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: UserSettingsStore,
        useValue: {
          currency: signal(currency),
          locale: signal<SupportedLocale>('fr'),
        },
      },
      {
        provide: CurrencyConverterService,
        useValue: { convertWithMetadata },
      },
      {
        provide: Logger,
        useValue: { error: vi.fn(), warn: vi.fn() },
      },
      { provide: StaleRateNotifier, useValue: { notify: vi.fn() } },
    ],
  });

  return {
    component: TestBed.createComponent(SavingsWithdrawalDialog)
      .componentInstance,
    close,
  };
}

describe('SavingsWithdrawalDialog', () => {
  it.each([
    ['CHF', '0.3 CHF'],
    ['EUR', '0,3 €'],
  ] as const)(
    'keeps the displayed, prefilled and submitted deficit exact in %s',
    async (currency, display) => {
      const { component, close } = createDialog(currency);

      expect(component['deficitChipDisplay']()).toBe(display);

      component['applyDeficit']();
      expect(component['model']().money.amount).toBe(0.3);

      await component['confirm']();
      expect(close).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0.3 }),
      );
    },
  );
});
