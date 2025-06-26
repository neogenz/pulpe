import { Injectable } from '@nestjs/common';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
} from '@pulpe/shared';

export interface BudgetTemplateDbEntity {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  is_default: boolean;
}

@Injectable()
export class BudgetTemplateMapper {
  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(templateDb: BudgetTemplateDbEntity): BudgetTemplate {
    return {
      id: templateDb.id,
      createdAt: templateDb.created_at,
      updatedAt: templateDb.updated_at,
      userId: templateDb.user_id,
      name: templateDb.name,
      description: templateDb.description,
      category: templateDb.category,
      isDefault: templateDb.is_default,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(templatesDb: BudgetTemplateDbEntity[]): BudgetTemplate[] {
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
      is_default: createDto.isDefault,
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
