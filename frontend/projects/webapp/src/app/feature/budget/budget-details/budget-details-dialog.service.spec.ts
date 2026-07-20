import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockTransaction } from '@app/testing/mock-factories';
import { of } from 'rxjs';
import type { TransactionUpdate } from 'pulpe-shared';
import { describe, expect, it, vi } from 'vitest';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { EditTransactionDialog } from './components/edit-transaction-form';

describe('BudgetDetailsDialogService', () => {
  it('locks the allocated transaction kind but keeps tags editable', async () => {
    const transaction = createMockTransaction({
      id: '11111111-1111-4111-8111-111111111111',
      tagIds: ['22222222-2222-4222-8222-222222222222'],
    });
    const update: TransactionUpdate = {
      name: transaction.name,
      amount: transaction.amount,
      kind: transaction.kind,
      transactionDate: transaction.transactionDate,
      tagIds: ['33333333-3333-4333-8333-333333333333'],
    };
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(update) });

    TestBed.configureTestingModule({
      providers: [
        ...provideTranslocoForTest(),
        BudgetDetailsDialogService,
        { provide: MatDialog, useValue: { open } },
        { provide: MatBottomSheet, useValue: { open: vi.fn() } },
      ],
    });

    const result = await TestBed.inject(
      BudgetDetailsDialogService,
    ).openEditAllocatedTransactionDialog(transaction, {
      budgetMonth: 7,
      budgetYear: 2026,
      payDayOfMonth: 1,
    });

    expect(open).toHaveBeenCalledWith(
      EditTransactionDialog,
      expect.objectContaining({
        data: expect.objectContaining({
          transaction,
          hiddenFields: ['kind'],
        }),
      }),
    );
    expect(result).toEqual({ id: transaction.id, update });
  });
});
