import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedCurrency } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import { AddTransactionBottomSheet } from './add-transaction-bottom-sheet';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

async function configureBottomSheet() {
  const afterOpened = new Subject<void>();
  const bottomSheetRef = {
    dismiss: vi.fn(),
    afterOpened: vi.fn().mockReturnValue(afterOpened),
  };
  const settings = {
    currency: signal<SupportedCurrency>('CHF'),
    showCurrencySelector: signal(true),
  };
  const converter = {
    convertWithMetadata: vi.fn().mockImplementation(async (amount: number) => ({
      convertedAmount: amount,
      metadata: null,
    })),
  };

  TestBed.configureTestingModule({
    imports: [AddTransactionBottomSheet],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: MatBottomSheetRef, useValue: bottomSheetRef },
      {
        provide: FeatureFlagsService,
        useValue: { isMultiCurrencyEnabled: signal(false) },
      },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(AddTransactionBottomSheet);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  TestBed.tick();

  return {
    fixture,
    component: fixture.componentInstance,
    bottomSheetRef,
    afterOpened,
  };
}

describe('AddTransactionBottomSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('focuses the amount after opening', async () => {
    const focusSpy = vi.spyOn(AddTransactionForm.prototype, 'focusAmount');
    const { afterOpened } = await configureBottomSheet();

    afterOpened.next();

    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it('dismisses without data on cancel', async () => {
    const { component, bottomSheetRef } = await configureBottomSheet();

    component['close']();

    expect(bottomSheetRef.dismiss).toHaveBeenCalledWith();
  });

  it('delegates submission to the shared form', async () => {
    const submitSpy = vi
      .spyOn(AddTransactionForm.prototype, 'submit')
      .mockResolvedValue();
    const { component } = await configureBottomSheet();

    component['submit']();

    expect(submitSpy).toHaveBeenCalledOnce();
  });

  it('dismisses with the shared form result', async () => {
    const { component, bottomSheetRef } = await configureBottomSheet();
    const transaction: TransactionFormData = {
      name: 'Courses',
      amount: 25,
      kind: 'expense',
      category: null,
      checkedAt: null,
    };

    component['onCreated'](transaction);

    expect(bottomSheetRef.dismiss).toHaveBeenCalledWith(transaction);
  });
});
