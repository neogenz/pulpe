import { Injectable } from '@nestjs/common';
import { type BudgetLine } from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type { BudgetLineRow } from '../../domain/budget-line.entity';

export type DecryptedBudgetLineRow = Omit<
  BudgetLineRow,
  'amount' | 'original_amount'
> & {
  amount: number;
  original_amount: number | null;
};

@Injectable()
export class BudgetLineMapper {
  toApi(row: DecryptedBudgetLineRow): BudgetLine {
    return {
      id: row.id,
      budgetId: row.budget_id,
      templateLineId: row.template_line_id,
      savingsGoalId: row.savings_goal_id,
      name: row.name,
      amount: row.amount,
      kind: row.kind,
      recurrence: row.recurrence,
      isManuallyAdjusted: row.is_manually_adjusted,
      checkedAt: row.checked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...mapCurrencyMetadataToApi(row),
    };
  }

  toApiList(rows: DecryptedBudgetLineRow[]): BudgetLine[] {
    return rows.map((row) => this.toApi(row));
  }
}
