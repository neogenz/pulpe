import { Injectable } from '@nestjs/common';
import {
  type SavingsGoal as SavingsGoalApi,
  type SupportedCurrency,
} from 'pulpe-shared';
import { parseCurrency } from '@common/utils/currency-metadata.mapper';
import type { SavingsGoal } from '../../domain/savings-goal.entity';

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
}
