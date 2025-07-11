import { Injectable } from '@nestjs/common';
import {
  TemplateLine,
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
} from '@pulpe/shared';
import { Tables, TablesInsert } from '@/types/database.types';

@Injectable()
export class BudgetTemplateMapper {
  /**
   * Transform database row (snake_case) to API entity (camelCase)
   */
  toApi(templateDb: Tables<'template'>): BudgetTemplate {
    return {
      id: templateDb.id,
      name: templateDb.name,
      description: templateDb.description ?? undefined,
      isDefault: templateDb.is_default,
      userId: templateDb.user_id ?? undefined,
      createdAt: templateDb.created_at,
      updatedAt: templateDb.updated_at,
    };
  }

  toApiLine(lineDb: Tables<'template_line'>): TemplateLine {
    return {
      id: lineDb.id,
      description: lineDb.description ?? '',
      createdAt: lineDb.created_at,
      updatedAt: lineDb.updated_at,
      kind: lineDb.kind,
      amount: lineDb.amount,
      name: lineDb.name,
      recurrence: lineDb.recurrence,
      templateId: lineDb.template_id,
    };
  }

  /**
   * Transform multiple database rows to API entities
   */
  toApiList(templatesDb: Tables<'template'>[]): BudgetTemplate[] {
    return templatesDb.map((template) => this.toApi(template));
  }

  /**
   * Transform create DTO (camelCase) to database insert (snake_case)
   */
  toInsert(
    createDto: BudgetTemplateCreate,
    userId: string,
  ): TablesInsert<'template'> {
    return {
      name: createDto.name,
      description: createDto.description ?? null,
      is_default: createDto.isDefault ?? false,
      user_id: userId,
    };
  }

  /**
   * Transform update DTO (camelCase) to database update (snake_case)
   */
  toUpdate(updateDto: BudgetTemplateUpdate): Partial<TablesInsert<'template'>> {
    const updateData: Partial<TablesInsert<'template'>> = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description ?? null;
    }
    if (updateDto.isDefault !== undefined) {
      updateData.is_default = updateDto.isDefault;
    }

    return updateData;
  }
}
