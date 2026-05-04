import type { TranslocoService } from '@jsverse/transloco';
import type { BudgetLine, SupportedCurrency, Transaction } from 'pulpe-shared';

export function computeEnvelopeSnackbarMessage(
  budgetLineId: string,
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  currency: SupportedCurrency,
  transloco: TranslocoService,
): string | null {
  const budgetLine = budgetLines.find((line) => line.id === budgetLineId);
  if (!budgetLine || budgetLine.checkedAt == null) return null;

  const consumed = transactions
    .filter(
      (tx) =>
        tx.budgetLineId === budgetLineId &&
        tx.checkedAt != null &&
        (tx.kind === 'expense' || tx.kind === 'saving'),
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const envelopeAmount = Math.abs(budgetLine.amount);
  const roundedConsumed = Math.round(consumed);
  const roundedEnvelope = Math.round(envelopeAmount);

  if (roundedConsumed > roundedEnvelope) {
    return transloco.translate('budget.snackbar.envelopeOver', {
      consumed: roundedConsumed,
      envelope: roundedEnvelope,
      currency,
    });
  }
  return transloco.translate('budget.snackbar.envelopeWithin', {
    envelope: roundedEnvelope,
    currency,
  });
}

export function computeTransactionSnackbarMessage(
  transactionId: string,
  transactions: Transaction[],
  currency: SupportedCurrency,
  transloco: TranslocoService,
): string | null {
  const transaction = transactions.find((tx) => tx.id === transactionId);
  if (!transaction || transaction.checkedAt == null) return null;

  return transloco.translate('budget.snackbar.transactionChecked', {
    amount: Math.round(Math.abs(transaction.amount)),
    currency,
  });
}
