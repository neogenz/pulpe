import { Injectable } from '@nestjs/common';
import { type Budget, type BudgetCreate, type BudgetUpdate } from '@pulpe/shared';

export interface BudgetDbEntity {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  month: number;
  year: number;
  description: string;
}

@Injectable()
export class BudgetMapper {
  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(budgetDb: BudgetDbEntity): Budget {
    return {
      id: budgetDb.id,
      createdAt: budgetDb.created_at,
      updatedAt: budgetDb.updated_at,
      userId: budgetDb.user_id,
      month: budgetDb.month,
      year: budgetDb.year,
      description: budgetDb.description,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(budgetsDb: BudgetDbEntity[]): Budget[] {
    return budgetsDb.map(budget => this.toApi(budget));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(createDto: BudgetCreate, userId: string): Omit<BudgetDbEntity, 'id' | 'created_at' | 'updated_at'> {
    return {
      month: createDto.month,
      year: createDto.year,
      description: createDto.description,
      user_id: userId,
    };
  }

  /**
   * Transforme un DTO de mise à jour (camelCase) vers format DB (snake_case)
   */
  toDbUpdate(updateDto: BudgetUpdate): Partial<Pick<BudgetDbEntity, 'month' | 'year' | 'description'>> {
    const updateData: Partial<Pick<BudgetDbEntity, 'month' | 'year' | 'description'>> = {};

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