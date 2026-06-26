import { describe, it, expect, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { MatSnackBar } from '@angular/material/snack-bar';
import type { TranslocoService } from '@jsverse/transloco';
import type {
  BudgetLine,
  BudgetLineSpreadCreate,
  Transaction,
} from 'pulpe-shared';
import {
  computeEnvelopeSnackbarMessage,
  computeTransactionSnackbarMessage,
  submitSpreadWithRetry,
} from './budget-details-snackbar.utils';

const NOW = new Date().toISOString();

function makeBudgetLine(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: 'bl-1',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Courses',
    amount: 408,
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetLineId: 'bl-1',
    name: 'Migros',
    amount: 200,
    kind: 'expense',
    transactionDate: NOW,
    category: null,
    createdAt: NOW,
    updatedAt: NOW,
    checkedAt: NOW,
    ...overrides,
  };
}

function createMockTransloco(): TranslocoService {
  return {
    translate: vi.fn((key: string, params?: Record<string, unknown>) => {
      switch (key) {
        case 'budget.snackbar.envelopeOver':
          return `Pointé · ${params?.['consumed']} ${params?.['currency']} — ${params?.['envelope']} ${params?.['currency']} prévus`;
        case 'budget.snackbar.envelopeWithin':
          return `Pointé · ${params?.['envelope']} ${params?.['currency']}`;
        case 'budget.snackbar.transactionChecked':
          return `Pointé · ${params?.['amount']} ${params?.['currency']}`;
        default:
          return key;
      }
    }),
  } as unknown as TranslocoService;
}

describe('computeEnvelopeSnackbarMessage', () => {
  const transloco = createMockTransloco();

  it('AC1 — returns null when checkedAt is null (unchecked)', () => {
    const budgetLine = makeBudgetLine({ checkedAt: null });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
      'CHF',
      transloco,
    );

    expect(result).toBeNull();
  });

  it('AC2 — returns a message when checked, without transactions', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 408 CHF');
  });

  it('AC2 — returns a message when checked, with transactions', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const tx = makeTransaction({ amount: 200, checkedAt: NOW });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [tx],
      'CHF',
      transloco,
    );

    expect(result).not.toBeNull();
  });

  it('AC3 — displays consumed when consumed > envelope (1574 > 408)', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const transactions = [
      makeTransaction({ id: 'tx-1', amount: 800, checkedAt: NOW }),
      makeTransaction({ id: 'tx-2', amount: 774, checkedAt: NOW }),
    ];

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      transactions,
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 1574 CHF — 408 CHF prévus');
  });

  it('AC3 — displays envelope amount when consumed < envelope (123 < 408)', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const tx = makeTransaction({ amount: 123, checkedAt: NOW });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [tx],
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 408 CHF');
  });

  it('AC3 — displays envelope amount when consumed = envelope (408 = 408)', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const transactions = [
      makeTransaction({ id: 'tx-1', amount: 200, checkedAt: NOW }),
      makeTransaction({ id: 'tx-2', amount: 208, checkedAt: NOW }),
    ];

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      transactions,
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 408 CHF');
  });

  it('AC3 — displays envelope when consumed = 0', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 408 CHF');
  });

  it('AC4 — ignores income transactions in consumed calculation', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const transactions = [
      makeTransaction({
        id: 'tx-1',
        amount: 200,
        kind: 'expense',
        checkedAt: NOW,
      }),
      makeTransaction({
        id: 'tx-2',
        amount: 5000,
        kind: 'income',
        checkedAt: NOW,
      }),
    ];

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      transactions,
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 408 CHF');
  });
});

describe('submitSpreadWithRetry', () => {
  const spreadValue: BudgetLineSpreadCreate = {
    name: 'Prime assurance',
    kind: 'expense',
    mode: 'total',
    totalAmount: 600,
    months: [{ year: 2026, month: 1 }],
    spreadGroupId: '11111111-1111-4111-8111-111111111111',
  };

  it('submits once and shows the occurrences toast on success', async () => {
    const transloco = createMockTransloco();
    const open = vi
      .fn()
      .mockReturnValue({ onAction: () => new Subject<void>() });
    const snackBar = { open } as unknown as MatSnackBar;
    const create = vi.fn().mockResolvedValue({
      lines: [{}],
      createdBudgets: [],
      skippedMonths: [],
    });

    await submitSpreadWithRetry(spreadValue, create, snackBar, transloco);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(spreadValue);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers a retry that re-submits the SAME DTO (same spreadGroupId) on failure', async () => {
    const transloco = createMockTransloco();
    const action$ = new Subject<void>();
    const open = vi.fn().mockReturnValue({ onAction: () => action$ });
    const snackBar = { open } as unknown as MatSnackBar;
    const create = vi.fn().mockResolvedValue(undefined);

    await submitSpreadWithRetry(spreadValue, create, snackBar, transloco);

    expect(create).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(
      'budgetLine.spread.error',
      'common.retry',
      expect.objectContaining({ duration: 8000 }),
    );

    // User taps "Réessayer" → the SAME value (hence the same spreadGroupId) is
    // resubmitted, so the server replays instead of creating a duplicate.
    action$.next();

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(2, spreadValue);
  });
});

describe('computeTransactionSnackbarMessage', () => {
  const transloco = createMockTransloco();

  it('AC5 — returns null when checkedAt is null (unchecked)', () => {
    const tx = makeTransaction({ checkedAt: null });

    const result = computeTransactionSnackbarMessage(
      tx.id,
      [tx],
      'CHF',
      transloco,
    );

    expect(result).toBeNull();
  });

  it('AC5 — returns a message when checked', () => {
    const tx = makeTransaction({ amount: 150, checkedAt: NOW });

    const result = computeTransactionSnackbarMessage(
      tx.id,
      [tx],
      'CHF',
      transloco,
    );

    expect(result).not.toBeNull();
  });

  it('AC6 — displays the rounded absolute amount of the transaction', () => {
    const tx = makeTransaction({ amount: 42, checkedAt: NOW });

    const result = computeTransactionSnackbarMessage(
      tx.id,
      [tx],
      'CHF',
      transloco,
    );

    expect(result).toBe('Pointé · 42 CHF');
  });
});
