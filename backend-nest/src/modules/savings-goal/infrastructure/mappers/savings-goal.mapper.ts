import { Injectable } from '@nestjs/common';
import {
  type LinkedSavingLine,
  type SavingsGoal as SavingsGoalApi,
  type SavingsGoalContribution as SavingsGoalContributionApi,
  type SavingsGoalFutureLine,
  type SavingsGoalProgress,
  type SupportedCurrency,
} from 'pulpe-shared';
import { parseCurrency } from '@common/utils/currency-metadata.mapper';
import { mapTransactionsToApi } from '@common/utils/transaction-api.mapper';
import type {
  SavingsGoal,
  SavingsGoalContribution,
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
      initialAmount: entity.initialAmount,
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
    months,
  }: SavingsGoalProgressComputation): SavingsGoalProgress {
    return {
      goalId: goal.id,
      status: goal.status,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      ...computed,
      months,
      originalTargetAmount: goal.originalTargetAmount,
      originalCurrency: parseCurrency(goal.originalCurrency) ?? null,
      targetCurrency: parseCurrency(goal.targetCurrency) ?? null,
      exchangeRate: goal.exchangeRate,
    };
  }

  /**
   * Contributions (PUL-12). Une par prévision Épargne liée, avec la période de
   * son budget parent ; les transactions imbriquées passent par le mapper
   * transaction commun (cœur camelCase + door-keepers FX).
   */
  /**
   * Candidates advisory à l'arrêt de génération (PUL-285 CA5) : conversion
   * entité (`LinkedSavingLine.id`) → DTO wire (`budgetLineId`).
   */
  toFutureLinesApi(lines: LinkedSavingLine[]): SavingsGoalFutureLine[] {
    return lines.map((line) => ({
      budgetLineId: line.id,
      amount: line.amount,
      month: line.month,
      year: line.year,
    }));
  }

  toContributionsApi(
    contributions: SavingsGoalContribution[],
  ): SavingsGoalContributionApi[] {
    return contributions.map((contribution) => ({
      lineId: contribution.lineId,
      name: contribution.name,
      amount: contribution.amount,
      checkedAt: contribution.checkedAt,
      budgetMonth: contribution.budgetMonth,
      budgetYear: contribution.budgetYear,
      transactions: mapTransactionsToApi(contribution.transactions),
    }));
  }
}
