import { describe, it, expect } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import {
  computeEnvelopeSnackbarMessage,
  computeTransactionSnackbarMessage,
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

describe('computeEnvelopeSnackbarMessage', () => {
  it('AC1 — returns null when checkedAt is null (unchecked)', () => {
    const budgetLine = makeBudgetLine({ checkedAt: null });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
    );

    expect(result).toBeNull();
  });

  it('AC2 — returns a message when checked, without transactions', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
    );

    expect(result).toBe('Comptabilisé 408 CHF (enveloppe)');
  });

  it('AC2 — returns a message when checked, with transactions', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const tx = makeTransaction({ amount: 200, checkedAt: NOW });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [tx],
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
    );

    expect(result).toBe('Comptabilisé 1574 sur 408 CHF (enveloppe)');
  });

  it('AC3 — displays envelope amount when consumed < envelope (123 < 408)', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });
    const tx = makeTransaction({ amount: 123, checkedAt: NOW });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [tx],
    );

    expect(result).toBe('Comptabilisé 408 CHF (enveloppe)');
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
    );

    expect(result).toBe('Comptabilisé 408 CHF (enveloppe)');
  });

  it('AC3 — displays envelope when consumed = 0', () => {
    const budgetLine = makeBudgetLine({ amount: 408 });

    const result = computeEnvelopeSnackbarMessage(
      budgetLine.id,
      [budgetLine],
      [],
    );

    expect(result).toBe('Comptabilisé 408 CHF (enveloppe)');
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
    );

    expect(result).toBe('Comptabilisé 408 CHF (enveloppe)');
  });
});

describe('computeTransactionSnackbarMessage', () => {
  it('AC5 — returns null when checkedAt is null (unchecked)', () => {
    const tx = makeTransaction({ checkedAt: null });

    const result = computeTransactionSnackbarMessage(tx.id, [tx]);

    expect(result).toBeNull();
  });

  it('AC5 — returns a message when checked', () => {
    const tx = makeTransaction({ amount: 150, checkedAt: NOW });

    const result = computeTransactionSnackbarMessage(tx.id, [tx]);

    expect(result).not.toBeNull();
  });

  it('AC6 — displays the rounded absolute amount of the transaction', () => {
    const tx = makeTransaction({ amount: 42, checkedAt: NOW });

    const result = computeTransactionSnackbarMessage(tx.id, [tx]);

    expect(result).toBe('Comptabilisé 42 CHF');
  });
});
