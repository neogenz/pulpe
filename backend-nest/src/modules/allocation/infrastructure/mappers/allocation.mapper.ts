import { Injectable } from '@nestjs/common';
import {
  type Budget as BudgetApi,
  type BudgetLine as BudgetLineApi,
  type SpreadOccurrence as SpreadOccurrenceApi,
  type Transaction as TransactionApi,
} from 'pulpe-shared';
import {
  type BudgetLineApiSource,
  mapBudgetLineToApi,
  mapBudgetLinesToApi,
  type SpreadOccurrenceApiSource,
  mapSpreadOccurrenceToApi,
  mapSpreadOccurrencesToApi,
} from '@common/utils/budget-line-api.mapper';
import {
  type BudgetApiSource,
  mapBudgetToApi,
  mapBudgetsToApi,
} from '@common/utils/budget-api.mapper';
import {
  type TransactionApiSource,
  mapTransactionToApi,
  mapTransactionsToApi,
} from '@common/utils/transaction-api.mapper';

@Injectable()
export class AllocationMapper {
  toTransactionApi(entity: TransactionApiSource): TransactionApi {
    return mapTransactionToApi(entity);
  }

  toTransactionApiList(entities: TransactionApiSource[]): TransactionApi[] {
    return mapTransactionsToApi(entities);
  }

  toBudgetLineApi(entity: BudgetLineApiSource): BudgetLineApi {
    return mapBudgetLineToApi(entity);
  }

  toBudgetLineApiList(entities: BudgetLineApiSource[]): BudgetLineApi[] {
    return mapBudgetLinesToApi(entities);
  }

  toBudgetApi(entity: BudgetApiSource): BudgetApi {
    return mapBudgetToApi(entity);
  }

  toBudgetApiList(entities: BudgetApiSource[]): BudgetApi[] {
    return mapBudgetsToApi(entities);
  }

  toSpreadOccurrenceApi(
    occurrence: SpreadOccurrenceApiSource,
  ): SpreadOccurrenceApi {
    return mapSpreadOccurrenceToApi(occurrence);
  }

  toSpreadOccurrenceApiList(
    occurrences: SpreadOccurrenceApiSource[],
  ): SpreadOccurrenceApi[] {
    return mapSpreadOccurrencesToApi(occurrences);
  }
}
