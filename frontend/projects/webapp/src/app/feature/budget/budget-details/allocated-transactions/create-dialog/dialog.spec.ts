import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { createMockDataCache } from '@core/testing';
import { TagStore } from '@core/tag';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import type { BudgetLine, TransactionCreate } from 'pulpe-shared';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './dialog';

const TRANSACTION = {
  budgetId: '22222222-2222-4222-8222-222222222222',
  budgetLineId: '11111111-1111-4111-8111-111111111111',
  name: 'Apport cuisine',
  amount: 500,
  kind: 'income',
} as TransactionCreate;

function configureDialog(
  submit: CreateAllocatedTransactionDialogData['submit'],
) {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CreateAllocatedTransactionDialog, MatDialogModule],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      provideNativeDateAdapter(),
      ...provideTranslocoForTest(),
      {
        provide: CurrencyConverterService,
        useValue: { convertWithMetadata: vi.fn() },
      },
      { provide: TagStore, useValue: createMockTagStore() },
      {
        provide: SavingsGoalApi,
        useValue: { cache: createMockDataCache(), getProgress$: vi.fn() },
      },
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          budgetLine: {
            id: TRANSACTION.budgetLineId,
            budgetId: TRANSACTION.budgetId,
            name: 'Apport cuisine',
            amount: 500,
            kind: 'income',
          } as BudgetLine,
          budgetMonth: 8,
          budgetYear: 2026,
          payDayOfMonth: null,
          submit,
        } satisfies CreateAllocatedTransactionDialogData,
      },
    ],
  });

  // No fixture.detectChanges(): onCreated — the method under test — never reads
  // the child form, so its inputs need not be bound.
  const fixture = TestBed.createComponent(CreateAllocatedTransactionDialog);
  return { component: fixture.componentInstance, dialogRef };
}

// PUL-329 v2 — realizing an announced withdrawal debits the goal, so the server
// can refuse it. Closing on refusal would throw away everything the user typed.
describe('CreateAllocatedTransactionDialog — a server refusal keeps the form open', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('stays open and shows the refusal reason', async () => {
    const submit = vi
      .fn<CreateAllocatedTransactionDialogData['submit']>()
      .mockResolvedValue('Ce montant dépasse ce que contient l’objectif.');
    const { component, dialogRef } = configureDialog(submit);

    await component.onCreated(TRANSACTION);

    expect(submit).toHaveBeenCalledWith(TRANSACTION);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['submitError']()).toBe(
      'Ce montant dépasse ce que contient l’objectif.',
    );
    expect(component['isSubmitting']()).toBe(false);
  });

  it('closes with the transaction once the server accepts it', async () => {
    const submit = vi
      .fn<CreateAllocatedTransactionDialogData['submit']>()
      .mockResolvedValue(null);
    const { component, dialogRef } = configureDialog(submit);

    await component.onCreated(TRANSACTION);

    expect(dialogRef.close).toHaveBeenCalledWith(TRANSACTION);
    expect(component['submitError']()).toBeNull();
  });

  it('drops a second submit arriving while one is already in flight', async () => {
    let resolveSubmit!: (value: string | null) => void;
    const submit = vi.fn<CreateAllocatedTransactionDialogData['submit']>(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { component } = configureDialog(submit);

    const first = component.onCreated(TRANSACTION);
    expect(component['isSubmitting']()).toBe(true);

    await component.onCreated(TRANSACTION);
    expect(submit).toHaveBeenCalledTimes(1);

    resolveSubmit(null);
    await first;
  });
});
