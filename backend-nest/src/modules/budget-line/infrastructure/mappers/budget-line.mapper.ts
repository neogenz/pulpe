import { Injectable } from '@nestjs/common';
import {
  type BudgetLine as BudgetLineApi,
  type Transaction as TransactionApi,
} from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type {
  BudgetLine,
  TransactionEntity,
} from '../../domain/budget-line.entity';

@Injectable()
export class BudgetLineMapper {
  toApi(entity: BudgetLine): BudgetLineApi {
    return {
      id: entity.id,
      budgetId: entity.budgetId,
      templateLineId: entity.templateLineId,
      savingsGoalId: entity.savingsGoalId,
      name: entity.name,
      amount: entity.amount,
      kind: entity.kind,
      recurrence: entity.recurrence,
      isManuallyAdjusted: entity.isManuallyAdjusted,
      checkedAt: entity.checkedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...mapCurrencyMetadataToApi({
        original_amount: entity.originalAmount,
        original_currency: entity.originalCurrency,
        target_currency: entity.targetCurrency,
        exchange_rate: entity.exchangeRate,
      }),
    };
  }

  toApiList(entities: BudgetLine[]): BudgetLineApi[] {
    return entities.map((entity) => this.toApi(entity));
  }

  toTransactionApi(entity: TransactionEntity): TransactionApi {
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

  toTransactionApiList(entities: TransactionEntity[]): TransactionApi[] {
    return entities.map((entity) => this.toTransactionApi(entity));
  }
}
