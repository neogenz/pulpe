import {
  type BudgetLine as BudgetLineApi,
  type SpreadOccurrence as SpreadOccurrenceApi,
} from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from './currency-metadata.mapper';

export interface BudgetLineApiSource {
  id: string;
  budgetId: string;
  templateLineId: string | null;
  savingsGoalId: string | null;
  spreadGroupId: string | null;
  name: string;
  amount: number;
  kind: BudgetLineApi['kind'];
  recurrence: BudgetLineApi['recurrence'];
  isManuallyAdjusted: boolean;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
}

export interface SpreadOccurrenceApiSource {
  budgetLineId: string;
  budgetId: string;
  month: number;
  year: number;
  name: string;
  amount: number;
  consumed: number;
  transactionCount: number;
  kind: SpreadOccurrenceApi['kind'];
  checkedAt: string | null;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
}

export function mapBudgetLineToApi(entity: BudgetLineApiSource): BudgetLineApi {
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

export function mapBudgetLinesToApi(
  entities: readonly BudgetLineApiSource[],
): BudgetLineApi[] {
  return entities.map((entity) => mapBudgetLineToApi(entity));
}

export function mapSpreadOccurrenceToApi(
  occurrence: SpreadOccurrenceApiSource,
): SpreadOccurrenceApi {
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

export function mapSpreadOccurrencesToApi(
  occurrences: readonly SpreadOccurrenceApiSource[],
): SpreadOccurrenceApi[] {
  return occurrences.map((occurrence) => mapSpreadOccurrenceToApi(occurrence));
}
