import { Injectable } from '@nestjs/common';
import { type BudgetLine as BudgetLineApi } from 'pulpe-shared';
import {
  mapBudgetLineToApi,
  mapBudgetLinesToApi,
} from '@common/utils/budget-line-api.mapper';
import type { BudgetLine } from '../../domain/budget-line.entity';

@Injectable()
export class BudgetLineMapper {
  toApi(entity: BudgetLine): BudgetLineApi {
    return mapBudgetLineToApi(entity);
  }

  toApiList(entities: BudgetLine[]): BudgetLineApi[] {
    return mapBudgetLinesToApi(entities);
  }
}
