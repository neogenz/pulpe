import { Injectable } from '@nestjs/common';
import { type BudgetLine as BudgetLineApi } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type { BudgetLine } from '../../domain/budget-line.entity';

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
}
