import { type Transaction as TransactionApi } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from './currency-metadata.mapper';

export interface TransactionApiSource {
  id: string;
  createdAt: string;
  updatedAt: string;
  budgetId: string;
  budgetLineId: string | null;
  amount: number;
  name: string;
  kind: TransactionApi['kind'];
  transactionDate: string;
  category: string | null;
  checkedAt: string | null;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
}

export function mapTransactionToApi(
  entity: TransactionApiSource,
): TransactionApi {
  return {
    id: entity.id,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    budgetId: entity.budgetId,
    budgetLineId: entity.budgetLineId,
    amount: entity.amount,
    name: entity.name,
    kind: entity.kind,
    transactionDate: entity.transactionDate,
    category: entity.category,
    checkedAt: entity.checkedAt,
    ...mapCurrencyMetadataToApi({
      original_amount: entity.originalAmount,
      original_currency: entity.originalCurrency,
      target_currency: entity.targetCurrency,
      exchange_rate: entity.exchangeRate,
    }),
  };
}

export function mapTransactionsToApi(
  entities: readonly TransactionApiSource[],
): TransactionApi[] {
  return entities.map((entity) => mapTransactionToApi(entity));
}
