import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ApiError } from '@core/api/api-error';
import {
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  type TransactionImportPreview,
} from 'pulpe-shared';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetDetailsStore } from '../store/budget-details-store';
import { TransactionImportApi } from './transaction-import-api';
import {
  TransactionImportDialog,
  type TransactionImportDialogData,
} from './transaction-import-dialog';
import type { TransactionImportOutcome } from './transaction-import.view-model';

const BUDGET_ID = '00000000-0000-4000-8000-000000000025';

function statementFile(size = 128): File {
  const file = new File(['<Document/>'], 'releve.xml', { type: 'text/xml' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function previewWith(
  overrides: Partial<TransactionImportPreview> = {},
): TransactionImportPreview {
  return {
    format: 'camt053',
    period: { startDate: '2026-03-01', endDate: '2026-03-31' },
    currency: 'CHF',
    operations: [
      {
        position: 1,
        date: '2026-03-04',
        name: 'Migros',
        amount: 42.5,
        kind: 'expense',
        status: 'new',
      },
      {
        position: 2,
        date: '2026-03-05',
        name: 'Coop',
        amount: 12,
        kind: 'expense',
        status: 'already_imported',
      },
    ],
    errors: [],
    ...overrides,
  };
}

describe('TransactionImportDialog', () => {
  let fixture: ComponentFixture<TransactionImportDialog>;
  let component: TransactionImportDialog;
  let preview$: ReturnType<typeof vi.fn>;
  let importTransactions: ReturnType<
    typeof vi.fn<
      (budgetId: string, file: File) => Promise<TransactionImportOutcome>
    >
  >;
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  beforeEach(() => {
    preview$ = vi.fn().mockReturnValue(of(previewWith()));
    importTransactions = vi.fn();
    dialogRef = { close: vi.fn(), disableClose: false };

    TestBed.configureTestingModule({
      imports: [TransactionImportDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            budgetId: BUDGET_ID,
          } satisfies TransactionImportDialogData,
        },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: TransactionImportApi, useValue: { preview$ } },
        { provide: BudgetDetailsStore, useValue: { importTransactions } },
      ],
    });

    fixture = TestBed.createComponent(TransactionImportDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function byTestId(id: string): HTMLElement | null {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  function confirmButton(): HTMLButtonElement {
    return byTestId('confirm-import-button') as HTMLButtonElement;
  }

  it('should refuse a file over the ceiling without calling the API', async () => {
    await component.selectFile(
      statementFile(TRANSACTION_IMPORT_MAX_FILE_BYTES + 1),
    );

    expect(preview$).not.toHaveBeenCalled();
    expect(component.state()).toEqual({ step: 'idle', isFileTooLarge: true });
    expect(byTestId('file-too-large-alert')?.textContent).toContain('2 Mo');
  });

  it('should preview the selected file for the current budget', async () => {
    const file = statementFile();

    await component.selectFile(file);

    expect(preview$).toHaveBeenCalledWith(BUDGET_ID, file);
    expect(component.state().step).toBe('preview');
    expect(byTestId('import-summary')?.textContent).toContain('1 à importer');
    expect(byTestId('import-summary')?.textContent).toContain(
      '1 déjà importée',
    );
    expect(byTestId('import-operation-status')?.textContent).toContain(
      'Déjà importée',
    );
    expect(confirmButton().disabled).toBe(false);
    expect(confirmButton().textContent).toContain('Importer 1 opération');
  });

  it('should report blocking errors and disable the confirmation', async () => {
    preview$.mockReturnValue(
      of(
        previewWith({
          errors: [
            { code: 'missing_date', position: 3 },
            { code: 'malformed_file', position: null },
          ],
        }),
      ),
    );

    await component.selectFile(statementFile());

    expect(component.canConfirm()).toBe(false);
    expect(confirmButton().disabled).toBe(true);
    const panel = byTestId('import-errors-panel')?.textContent ?? '';
    expect(panel).toContain('Opération n°3 : Date manquante.');
    expect(panel).toContain('Le fichier est illisible ou incomplet.');
    expect(panel).not.toMatch(/transaction/i);
  });

  it('should close with the result once the import succeeds', async () => {
    const file = statementFile();
    const outcome: TransactionImportOutcome = {
      status: 'imported',
      result: { createdCount: 1, skippedCount: 1 },
    };
    importTransactions.mockResolvedValue(outcome);
    await component.selectFile(file);

    await component.confirm();

    expect(importTransactions).toHaveBeenCalledWith(BUDGET_ID, file);
    expect(component.state()).toEqual({ step: 'done', result: outcome });
    expect(dialogRef.close).toHaveBeenCalledWith(outcome);
    expect(dialogRef.disableClose).toBe(false);
  });

  it('should close with the warning when the Réels exist but balances lag', async () => {
    const outcome: TransactionImportOutcome = {
      status: 'importedWithWarning',
      message: 'recharge la page',
    };
    importTransactions.mockResolvedValue(outcome);
    await component.selectFile(statementFile());

    await component.confirm();

    expect(dialogRef.close).toHaveBeenCalledWith(outcome);
  });

  it('should offer a fresh preview of the same file after a conflict', async () => {
    const file = statementFile();
    importTransactions.mockResolvedValue({
      status: 'failed',
      message: 'Certaines opérations ont été importées entre-temps',
      code: 'ERR_TRANSACTION_IMPORT_CONFLICT',
    });
    await component.selectFile(file);

    await component.confirm();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.state()).toMatchObject({
      step: 'failed',
      stage: 'import',
      preview: null,
    });
    expect(byTestId('import-failure-alert')?.textContent).toContain(
      'Certaines opérations ont été importées entre-temps',
    );
    expect(byTestId('retry-button')?.textContent).toContain(
      "Relancer l'aperçu",
    );

    preview$.mockClear();
    byTestId('retry-button')?.click();
    await fixture.whenStable();

    expect(preview$).toHaveBeenCalledWith(BUDGET_ID, file);
    expect(importTransactions).toHaveBeenCalledTimes(1);
    expect(component.state().step).toBe('preview');
  });

  it('should retry the same confirmation after a plain failure', async () => {
    const file = statementFile();
    importTransactions.mockResolvedValueOnce({
      status: 'failed',
      message: "L'import a échoué",
      code: 'ERR_TRANSACTION_IMPORT_FAILED',
    });
    await component.selectFile(file);
    await component.confirm();
    expect(byTestId('retry-button')?.textContent).toContain('Réessayer');

    importTransactions.mockResolvedValueOnce({
      status: 'imported',
      result: { createdCount: 1, skippedCount: 0 },
    });
    await component.retry();

    expect(importTransactions).toHaveBeenCalledTimes(2);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('should show the localized API error when the preview fails', async () => {
    preview$.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            'missing',
            'ERR_TRANSACTION_IMPORT_FILE_MISSING',
            400,
            null,
          ),
      ),
    );

    await component.selectFile(statementFile());

    expect(component.state()).toMatchObject({
      step: 'failed',
      stage: 'preview',
    });
    expect(byTestId('import-failure-alert')?.textContent).toContain(
      'Aucun fichier reçu',
    );
  });
});
