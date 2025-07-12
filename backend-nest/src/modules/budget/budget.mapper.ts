import { Injectable } from '@nestjs/common';
import {
  type Budget,
  type BudgetCreate,
  type BudgetUpdate,
} from '@pulpe/shared';
import { Tables, TablesInsert } from '@/types/database.types';

@Injectable()
export class BudgetMapper {
  /**
   * Transform database row (snake_case) to API entity (camelCase)
   */
  toApi(budgetDb: Tables<'monthly_budget'>): Budget {
    return {
      id: budgetDb.id,
      createdAt: budgetDb.created_at,
      updatedAt: budgetDb.updated_at,
      userId: budgetDb.user_id ?? undefined,
      month: budgetDb.month,
      year: budgetDb.year,
      description: budgetDb.description,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(budgetsDb: Tables<'monthly_budget'>[]): Budget[] {
    return budgetsDb.map((budgetDb) => this.toApi(budgetDb));
  }

  /**
   * Transform create DTO (camelCase) to database insert (snake_case)
   */
  toInsert(
    createDto: BudgetCreate,
    userId: string,
  ): TablesInsert<'monthly_budget'> {
    return {
      month: createDto.month,
      year: createDto.year,
      description: createDto.description,
      user_id: userId,
      template_id: createDto.templateId,
    };
  }

  /**
   * Transform update DTO (camelCase) to database update (snake_case)
   */
  toUpdate(updateDto: BudgetUpdate): Partial<TablesInsert<'monthly_budget'>> {
    const updateData: Partial<TablesInsert<'monthly_budget'>> = {};

    if (updateDto.month !== undefined) {
      updateData.month = updateDto.month;
    }
    if (updateDto.year !== undefined) {
      updateData.year = updateDto.year;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    return updateData;
  }
}
