import type { BudgetLine, Transaction } from 'pulpe-shared';

export function computeEnvelopeSnackbarMessage(
  budgetLineId: string,
  budgetLines: BudgetLine[],
  transactions: Transaction[],
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
    return `Comptabilisé ${roundedConsumed} sur ${roundedEnvelope} CHF (enveloppe)`;
  }
  return `Comptabilisé ${roundedEnvelope} CHF (enveloppe)`;
}

export function computeTransactionSnackbarMessage(
  transactionId: string,
  transactions: Transaction[],
): string | null {
  const transaction = transactions.find((tx) => tx.id === transactionId);
  if (!transaction || transaction.checkedAt == null) return null;

  return `Comptabilisé ${Math.round(Math.abs(transaction.amount))} CHF`;
}
