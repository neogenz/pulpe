import { Injectable } from '@nestjs/common';
import { type Transaction } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type { TransactionRow } from '../../domain/transaction.entity';

export type DecryptedTransactionRow = Omit<
  TransactionRow,
  'amount' | 'original_amount'
> & {
  amount: number;
  original_amount: number | null;
};

@Injectable()
export class TransactionMapper {
  toApi(row: DecryptedTransactionRow): Transaction {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      budgetId: row.budget_id,
      budgetLineId: row.budget_line_id ?? null,
      amount: row.amount,
      name: row.name,
      kind: row.kind,
      transactionDate: row.transaction_date,
      category: row.category,
      checkedAt: row.checked_at ?? null,
      ...mapCurrencyMetadataToApi(row),
    };
  }

  toApiList(rows: DecryptedTransactionRow[]): Transaction[] {
    return rows.map((row) => this.toApi(row));
  }
}
