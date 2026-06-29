import { Injectable } from '@nestjs/common';
import {
  type Budget as BudgetApi,
  type BudgetLine as BudgetLineApi,
  type SpreadOccurrence as SpreadOccurrenceApi,
} from 'pulpe-shared';
import {
  mapBudgetLineToApi,
  mapBudgetLinesToApi,
  mapSpreadOccurrenceToApi,
  mapSpreadOccurrencesToApi,
} from '@common/utils/budget-line-api.mapper';
import {
  type BudgetApiSource,
  mapBudgetToApi,
  mapBudgetsToApi,
} from '@common/utils/budget-api.mapper';
import type {
  BudgetLine,
  SpreadOccurrence,
} from '../../domain/budget-line.entity';

@Injectable()
export class BudgetLineMapper {
  toApi(entity: BudgetLine): BudgetLineApi {
    return mapBudgetLineToApi(entity);
  }

  toApiList(entities: BudgetLine[]): BudgetLineApi[] {
    return mapBudgetLinesToApi(entities);
  }

  toBudgetApi(entity: BudgetApiSource): BudgetApi {
    return mapBudgetToApi(entity);
  }

  toBudgetApiList(entities: BudgetApiSource[]): BudgetApi[] {
    return mapBudgetsToApi(entities);
  }

  toSpreadOccurrenceApi(occurrence: SpreadOccurrence): SpreadOccurrenceApi {
    return mapSpreadOccurrenceToApi(occurrence);
  }

  toSpreadOccurrenceApiList(
    occurrences: SpreadOccurrence[],
  ): SpreadOccurrenceApi[] {
    return mapSpreadOccurrencesToApi(occurrences);
  }
}
