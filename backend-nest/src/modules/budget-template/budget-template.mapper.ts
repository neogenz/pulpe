import { Injectable } from '@nestjs/common';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
} from '@pulpe/shared';
import type {
  BudgetTemplateRow,
  BudgetTemplateInsert,
} from './entities/budget-template.entity';

@Injectable()
export class BudgetTemplateMapper {
  /**
   * Transform database row (snake_case) to API entity (camelCase)
   */
  toApi(templateDb: BudgetTemplateRow): BudgetTemplate {
    return {
      id: templateDb.id,
      name: templateDb.name,
      description: templateDb.description ?? undefined,
      category: templateDb.category ?? undefined,
      isDefault: templateDb.is_default,
      userId: templateDb.user_id ?? undefined,
      createdAt: templateDb.created_at,
      updatedAt: templateDb.updated_at,
    };
  }

  /**
   * Transform multiple database rows to API entities
   */
  toApiList(templatesDb: BudgetTemplateRow[]): BudgetTemplate[] {
    return templatesDb.map((template) => this.toApi(template));
  }

  /**
   * Transform create DTO (camelCase) to database insert (snake_case)
   */
  toInsert(
    createDto: BudgetTemplateCreate,
    userId: string,
  ): BudgetTemplateInsert {
    return {
      name: createDto.name,
      description: createDto.description ?? null,
      category: createDto.category ?? null,
      is_default: createDto.isDefault ?? false,
      user_id: userId,
    };
  }

  /**
   * Transform update DTO (camelCase) to database update (snake_case)
   */
  toUpdate(updateDto: BudgetTemplateUpdate): Partial<BudgetTemplateInsert> {
    const updateData: Partial<BudgetTemplateInsert> = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description ?? null;
    }
    if (updateDto.category !== undefined) {
      updateData.category = updateDto.category ?? null;
    }
    if (updateDto.isDefault !== undefined) {
      updateData.is_default = updateDto.isDefault;
    }

    return updateData;
  }
}
