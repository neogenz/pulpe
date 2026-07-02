import { Injectable } from '@nestjs/common';
import {
  type SavingsGoal as SavingsGoalApi,
  type SavingsGoalProgress,
  type SavingsGoalTransaction,
  type SupportedCurrency,
} from 'pulpe-shared';
import { parseCurrency } from '@common/utils/currency-metadata.mapper';
import { mapTransactionToApi } from '@common/utils/transaction-api.mapper';
import type {
  SavingsGoal,
  SavingsGoalLinkedTransaction,
  SavingsGoalProgressComputation,
} from '../../domain/savings-goal.entity';

interface SavingsGoalCurrencyMetadataApi {
  originalTargetAmount?: number;
  originalCurrency?: SupportedCurrency;
  targetCurrency?: SupportedCurrency;
  exchangeRate?: number;
}

/**
 * PUL-12 door-keeper — dedicated FX mapper for savings_goal.
 *
 * The encrypted source field is `originalTargetAmount` (≠ the generic
 * `originalAmount`), so `mapCurrencyMetadataToApi` would target the wrong field
 * and surface the target at 0. v1 is account-currency only — these are all null.
 */
export function mapSavingsGoalCurrencyMetadataToApi(
  entity: SavingsGoal,
): SavingsGoalCurrencyMetadataApi {
  return {
    originalTargetAmount: entity.originalTargetAmount ?? undefined,
    originalCurrency: parseCurrency(entity.originalCurrency),
    targetCurrency: parseCurrency(entity.targetCurrency),
    exchangeRate: entity.exchangeRate ?? undefined,
  };
}

@Injectable()
export class SavingsGoalMapper {
  toApi(entity: SavingsGoal): SavingsGoalApi {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      targetAmount: entity.targetAmount,
      targetDate: entity.targetDate,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...mapSavingsGoalCurrencyMetadataToApi(entity),
    };
  }

  toApiList(entities: SavingsGoal[]): SavingsGoalApi[] {
    return entities.map((entity) => this.toApi(entity));
  }

  /**
   * Progress DTO (PUL-8). FX door-keepers mirror the goal's dormant metadata
   * (`original_target_amount` source field) — always null in v1 (CA6).
   */
  toProgressApi({
    goal,
    computed,
  }: SavingsGoalProgressComputation): SavingsGoalProgress {
    return {
      goalId: goal.id,
      status: goal.status,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      ...computed,
      originalTargetAmount: goal.originalTargetAmount,
      originalCurrency: parseCurrency(goal.originalCurrency) ?? null,
      targetCurrency: parseCurrency(goal.targetCurrency) ?? null,
      exchangeRate: goal.exchangeRate,
    };
  }

  /**
   * Transactions liées (PUL-12). Réutilise le mapper transaction commun pour
   * le cœur camelCase + door-keepers FX, puis attache la période du budget
   * parent (`budgetMonth`/`budgetYear`) qui situe chaque transaction.
   */
  toTransactionsApi(
    transactions: SavingsGoalLinkedTransaction[],
  ): SavingsGoalTransaction[] {
    return transactions.map((transaction) => ({
      ...mapTransactionToApi(transaction),
      budgetMonth: transaction.budgetMonth,
      budgetYear: transaction.budgetYear,
    }));
  }
}
