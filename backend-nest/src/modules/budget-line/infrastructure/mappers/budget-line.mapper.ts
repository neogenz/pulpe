import { Injectable } from '@nestjs/common';
import {
  type BudgetLine as BudgetLineApi,
  type SpreadOccurrence as SpreadOccurrenceApi,
} from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type {
  BudgetLine,
  SpreadOccurrence,
} from '../../domain/budget-line.entity';

@Injectable()
export class BudgetLineMapper {
  toApi(entity: BudgetLine): BudgetLineApi {
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

  toApiList(entities: BudgetLine[]): BudgetLineApi[] {
    return entities.map((entity) => this.toApi(entity));
  }

  toSpreadOccurrenceApi(occurrence: SpreadOccurrence): SpreadOccurrenceApi {
    return {
      budgetLineId: occurrence.budgetLineId,
      budgetId: occurrence.budgetId,
      month: occurrence.month,
      year: occurrence.year,
      name: occurrence.name,
      amount: occurrence.amount,
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
