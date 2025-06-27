import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
} from '@pulpe/shared';
import {
  budgetTemplateDbEntitySchema,
  type BudgetTemplateDbEntity,
} from './schemas/budget-template.db.schema';

@Injectable()
export class BudgetTemplateMapper {
  /**
   * Valide les données venant de la DB avec Zod
   */
  private validateDbEntity(dbEntity: unknown): BudgetTemplateDbEntity {
    const validationResult = budgetTemplateDbEntitySchema.safeParse(dbEntity);
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
  toApi(templateDb: unknown): BudgetTemplate {
    // Validate DB data first - fail fast on corrupted data
    const validatedDb = this.validateDbEntity(templateDb);

    return {
      id: validatedDb.id,
      createdAt: validatedDb.created_at,
      updatedAt: validatedDb.updated_at,
      userId: validatedDb.user_id ?? undefined,
      name: validatedDb.name,
      description: validatedDb.description ?? undefined,
      category: validatedDb.category ?? undefined,
      isDefault: validatedDb.is_default ?? false,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(templatesDb: unknown[]): BudgetTemplate[] {
    return templatesDb.map((template) => this.toApi(template));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(
    createDto: BudgetTemplateCreate,
    userId: string,
  ): Omit<BudgetTemplateDbEntity, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: createDto.name,
      description: createDto.description ?? null,
      category: createDto.category ?? null,
      is_default: createDto.isDefault ?? false,
      user_id: userId,
    };
  }

  /**
   * Transforme un DTO de mise à jour (camelCase) vers format DB (snake_case)
   */
  toDbUpdate(
    updateDto: BudgetTemplateUpdate,
  ): Partial<
    Pick<
      BudgetTemplateDbEntity,
      'name' | 'description' | 'category' | 'is_default'
    >
  > {
    const updateData: Partial<
      Pick<
        BudgetTemplateDbEntity,
        'name' | 'description' | 'category' | 'is_default'
      >
    > = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }
    if (updateDto.category !== undefined) {
      updateData.category = updateDto.category;
    }
    if (updateDto.isDefault !== undefined) {
      updateData.is_default = updateDto.isDefault;
    }

    return updateData;
  }
}
