import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  type Budget,
  type BudgetCreate,
  type BudgetUpdate,
} from '@pulpe/shared';
import {
  budgetDbEntitySchema,
  type BudgetDbEntity,
} from './schemas/budget.db.schema';

@Injectable()
export class BudgetMapper {
  /**
   * Valide les données venant de la DB avec Zod
   */
  private validateDbEntity(dbEntity: unknown): BudgetDbEntity {
    const validationResult = budgetDbEntitySchema.safeParse(dbEntity);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new InternalServerErrorException(
        `Invalid DB data: ${firstError.path.join('.')} - ${firstError.message}`,
      );
    }
    return validationResult.data;
  }

  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(budgetDb: unknown): Budget {
    // Validate DB data first - fail fast on corrupted data
    const validatedDb = this.validateDbEntity(budgetDb);

    return {
      id: validatedDb.id,
      createdAt: validatedDb.created_at,
      updatedAt: validatedDb.updated_at,
      userId: validatedDb.user_id ?? undefined,
      month: validatedDb.month,
      year: validatedDb.year,
      description: validatedDb.description,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(budgetsDb: unknown[]): Budget[] {
    return budgetsDb.map((budget) => this.toApi(budget));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(
    createDto: BudgetCreate,
    userId: string,
  ): Omit<BudgetDbEntity, 'id' | 'created_at' | 'updated_at'> {
    return {
      month: createDto.month ?? 1,
      year: createDto.year ?? new Date().getFullYear(),
      description: createDto.description ?? '',
      user_id: userId,
    };
  }

  /**
   * Transforme un DTO de mise à jour (camelCase) vers format DB (snake_case)
   */
  toDbUpdate(
    updateDto: BudgetUpdate,
  ): Partial<Pick<BudgetDbEntity, 'month' | 'year' | 'description'>> {
    const updateData: Partial<
      Pick<BudgetDbEntity, 'month' | 'year' | 'description'>
    > = {};

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
