import { type Transaction } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import { type TransactionRow } from './entities/transaction.entity';

/**
 * Transform database row (snake_case) to API entity (camelCase)
 * Expects decrypted transactionDb where amount is already a number
 */
export type DecryptedTransactionRow = Omit<
  TransactionRow,
  'amount' | 'original_amount'
> & {
  amount: number;
  original_amount: number | null;
};

export function toApi(transactionDb: DecryptedTransactionRow): Transaction {
  return {
    id: transactionDb.id,
    createdAt: transactionDb.created_at,
    updatedAt: transactionDb.updated_at,
    budgetId: transactionDb.budget_id,
    budgetLineId: transactionDb.budget_line_id ?? null,
    amount: transactionDb.amount,
    name: transactionDb.name,
    kind: transactionDb.kind, // Pas de conversion - les enums sont maintenant unifiés
    transactionDate: transactionDb.transaction_date,
    category: transactionDb.category,
    checkedAt: transactionDb.checked_at ?? null,
    ...mapCurrencyMetadataToApi(transactionDb),
  };
}

/**
 * Transform multiple database rows to API entities
 * Expects decrypted transactionsDb where amount is already a number
 */
export function toApiList(
  transactionsDb: DecryptedTransactionRow[],
): Transaction[] {
  return transactionsDb.map((transaction) => toApi(transaction));
}
