import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY } from 'rxjs';
import type { SupportedCurrency } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import { CurrencyConverterService } from '@core/currency';
import { TagStore } from '@core/tag';
import { UserSettingsStore } from '@core/user-settings';
import { AddTransactionDialogService } from '../services/add-transaction-dialog.service';
import { AddTransactionBottomSheet } from './add-transaction-bottom-sheet';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

async function configureBottomSheet() {
  const bottomSheetRef = {
    dismiss: vi.fn(),
    backdropClick: () => EMPTY,
    keydownEvents: () => EMPTY,
  };
  const dialogService = {
    confirmDiscard: vi.fn().mockResolvedValue(true),
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
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: TagStore, useValue: createMockTagStore() },
      { provide: AddTransactionDialogService, useValue: dialogService },
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
    dialogService,
    form: fixture.debugElement.query(By.directive(AddTransactionForm))
      .componentInstance as AddTransactionForm,
  };
}

describe('AddTransactionBottomSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should dismiss without data on cancel', async () => {
    const { component, bottomSheetRef } = await configureBottomSheet();

    component['close']();

    expect(bottomSheetRef.dismiss).toHaveBeenCalledWith();
  });

  it('should keep a typed transaction when the user declines to discard it', async () => {
    const { component, bottomSheetRef, dialogService, form } =
      await configureBottomSheet();
    dialogService.confirmDiscard.mockResolvedValue(false);
    form['model'].update((model) => ({ ...model, name: 'Courses' }));

    await component['close']();

    expect(dialogService.confirmDiscard).toHaveBeenCalledOnce();
    expect(bottomSheetRef.dismiss).not.toHaveBeenCalled();
  });

  it('should discard a typed transaction once the user confirms', async () => {
    const { component, bottomSheetRef, dialogService, form } =
      await configureBottomSheet();
    dialogService.confirmDiscard.mockResolvedValue(true);
    form['model'].update((model) => ({ ...model, name: 'Courses' }));

    await component['close']();

    expect(bottomSheetRef.dismiss).toHaveBeenCalledWith();
  });

  it('should delegate submission to the shared form', async () => {
    const submitSpy = vi
      .spyOn(AddTransactionForm.prototype, 'submit')
      .mockResolvedValue();
    const { fixture } = await configureBottomSheet();

    fixture.nativeElement
      .querySelector('pulpe-loading-button[testId="transaction-submit-button"]')
      .click();

    expect(submitSpy).toHaveBeenCalledOnce();
  });

  it('should dismiss with the shared form result', async () => {
    const { component, bottomSheetRef } = await configureBottomSheet();
    const transaction: TransactionFormData = {
      name: 'Courses',
      amount: 25,
      kind: 'expense',
      tagIds: [],
      isChecked: false,
      conversion: null,
    };

    component['onCreated'](transaction);

    expect(bottomSheetRef.dismiss).toHaveBeenCalledWith(transaction);
  });
});
