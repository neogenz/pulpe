import { Injectable } from '@nestjs/common';
import {
  type Budget as BudgetApi,
  type BudgetLine as BudgetLineApi,
  type SpreadOccurrence as SpreadOccurrenceApi,
  type Transaction as TransactionApi,
} from 'pulpe-shared';
import {
  mapBudgetToApi,
  mapBudgetsToApi,
} from '@common/utils/budget-api.mapper';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type { Budget } from '../../../budget/domain/budget.entity';
import type {
  BudgetLine,
  SpreadOccurrence,
} from '../../../budget-line/domain/budget-line.entity';
import type { Transaction } from '../../../transaction/domain/transaction.entity';

@Injectable()
export class AllocationMapper {
  toTransactionApi(entity: Transaction): TransactionApi {
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

  toTransactionApiList(entities: Transaction[]): TransactionApi[] {
    return entities.map((entity) => this.toTransactionApi(entity));
  }

  toBudgetLineApi(entity: BudgetLine): BudgetLineApi {
    return {
      id: entity.id,
      budgetId: entity.budgetId,
      templateLineId: entity.templateLineId,
      savingsGoalId: entity.savingsGoalId,
      spreadGroupId: entity.spreadGroupId,
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

  toBudgetLineApiList(entities: BudgetLine[]): BudgetLineApi[] {
    return entities.map((entity) => this.toBudgetLineApi(entity));
  }

  toBudgetApi(entity: Budget): BudgetApi {
    return mapBudgetToApi(entity);
  }

  toBudgetApiList(entities: Budget[]): BudgetApi[] {
    return mapBudgetsToApi(entities);
  }

  toSpreadOccurrenceApi(occurrence: SpreadOccurrence): SpreadOccurrenceApi {
    return {
      budgetLineId: occurrence.budgetLineId,
      budgetId: occurrence.budgetId,
      month: occurrence.month,
      year: occurrence.year,
      name: occurrence.name,
      amount: occurrence.amount,
      consumed: occurrence.consumed,
      transactionCount: occurrence.transactionCount,
      kind: occurrence.kind,
      checkedAt: occurrence.checkedAt,
      ...mapCurrencyMetadataToApi({
        original_amount: occurrence.originalAmount,
        original_currency: occurrence.originalCurrency,
        target_currency: occurrence.targetCurrency,
        exchange_rate: occurrence.exchangeRate,
      }),
    };
  }

  toSpreadOccurrenceApiList(
    occurrences: SpreadOccurrence[],
  ): SpreadOccurrenceApi[] {
    return occurrences.map((occurrence) =>
      this.toSpreadOccurrenceApi(occurrence),
    );
  }
}
