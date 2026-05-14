import { Injectable } from '@nestjs/common';
import { type Transaction as TransactionApi } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type { Transaction } from '../../domain/transaction.entity';

@Injectable()
export class TransactionMapper {
  toApi(entity: Transaction): TransactionApi {
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

  toApiList(entities: Transaction[]): TransactionApi[] {
    return entities.map((entity) => this.toApi(entity));
  }
}
