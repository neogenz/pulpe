import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { provideLocale } from '@core/locale';
import { StorageService } from '@core/storage/storage.service';
import { Logger } from '@core/logging/logger';
import { CurrencyConverterService } from '@core/currency';
import { TagStore } from '@core/tag';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import type { Transaction, TransactionUpdate } from 'pulpe-shared';
import {
  EditTransactionDialog,
  type EditTransactionDialogData,
} from './edit-transaction-dialog';

interface DialogRefMock {
  close: ReturnType<typeof vi.fn>;
}

const mockStorageService: Partial<StorageService> = {
  get: () => null,
  getString: () => null,
  set: vi.fn(),
  setString: vi.fn(),
  remove: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'b-1',
    budgetLineId: null,
    name: 'Loyer',
    amount: 1200,
    kind: 'expense',
    transactionDate: new Date().toISOString(),
    tagIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkedAt: null,
    ...overrides,
  } as Transaction;
}

const UPDATE: TransactionUpdate = {
  name: 'Loyer',
  amount: 1300,
  kind: 'expense',
  transactionDate: new Date().toISOString(),
  tagIds: [],
};

function configureDialog(submit: EditTransactionDialogData['submit']) {
  const dialogRef: DialogRefMock = { close: vi.fn() };
  const converter = {
    convertWithMetadata: vi.fn().mockResolvedValue({
      convertedAmount: 0,
      metadata: null,
    }),
  };

  TestBed.configureTestingModule({
    imports: [EditTransactionDialog, MatDialogModule],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      provideAnimationsAsync(),
      provideRouter([]),
      ...provideLocale(),
      { provide: StorageService, useValue: mockStorageService },
      { provide: Logger, useValue: mockLogger },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: TagStore, useValue: createMockTagStore() },
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          transaction: makeTransaction(),
          submit,
        } satisfies EditTransactionDialogData,
      },
    ],
  });

  // No fixture.detectChanges(): onUpdateTransaction — the method under test
  // — never reads editForm(), so the child form's inputs need not be bound.
  const fixture = TestBed.createComponent(EditTransactionDialog);
  return { component: fixture.componentInstance, dialogRef };
}

describe('EditTransactionDialog — a server refusal keeps the form open (PUL-329)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('stays open and shows the refusal reason when the server rejects the update', async () => {
    const submit = vi
      .fn<EditTransactionDialogData['submit']>()
      .mockResolvedValue('Le solde de l’objectif est insuffisant');
    const { component, dialogRef } = configureDialog(submit);

    await component['onUpdateTransaction'](UPDATE);

    expect(submit).toHaveBeenCalledWith(UPDATE);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['submitError']()).toBe(
      'Le solde de l’objectif est insuffisant',
    );
    expect(component['isSubmitting']()).toBe(false);
  });

  it('closes with the update once the server accepts it', async () => {
    const submit = vi
      .fn<EditTransactionDialogData['submit']>()
      .mockResolvedValue(null);
    const { component, dialogRef } = configureDialog(submit);

    await component['onUpdateTransaction'](UPDATE);

    expect(dialogRef.close).toHaveBeenCalledWith(UPDATE);
    expect(component['submitError']()).toBeNull();
    expect(component['isSubmitting']()).toBe(false);
  });

  it('drops a second submit arriving while one is already in flight', async () => {
    let resolveSubmit!: (value: string | null) => void;
    const submit = vi.fn<EditTransactionDialogData['submit']>(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { component } = configureDialog(submit);

    const first = component['onUpdateTransaction'](UPDATE);
    expect(component['isSubmitting']()).toBe(true);

    await component['onUpdateTransaction'](UPDATE);
    expect(submit).toHaveBeenCalledTimes(1);

    resolveSubmit(null);
    await first;
  });
});
