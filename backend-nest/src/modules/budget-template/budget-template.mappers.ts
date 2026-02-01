import {
  TemplateLine,
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineUpdate,
} from 'pulpe-shared';
import { Tables, TablesInsert } from '@/types/database.types';

// Simple mapping functions - no need for a class

// Enum values are now consistent between shared schemas and database
// No conversion needed - both use the new enum values ('income', 'expense', 'saving')

export const toApiTemplate = (db: Tables<'template'>): BudgetTemplate => ({
  id: db.id,
  name: db.name,
  description: db.description ?? undefined,
  isDefault: db.is_default,
  userId: db.user_id ?? undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export const toApiTemplateLine = (
  db: Tables<'template_line'>,
): TemplateLine => ({
  id: db.id,
  description: db.description ?? '',
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  kind: db.kind,
  amount: db.amount,
  name: db.name,
  recurrence: db.recurrence,
  templateId: db.template_id,
});

/**
 * Transform multiple database template rows to API entities
 */
export const toApiTemplateList = (
  templatesDb: Tables<'template'>[],
): BudgetTemplate[] => {
  return templatesDb.map(toApiTemplate);
};

/**
 * Transform multiple database template line rows to API entities
 */
export const toApiTemplateLineList = (
  linesDb: Tables<'template_line'>[],
): TemplateLine[] => {
  return linesDb.map(toApiTemplateLine);
};

export const toDbTemplateInsert = (
  dto: BudgetTemplateCreate,
  userId: string,
): TablesInsert<'template'> => ({
  name: dto.name,
  description: dto.description ?? null,
  is_default: dto.isDefault ?? false,
  user_id: userId,
});

export const toDbTemplateUpdate = (
  dto: BudgetTemplateUpdate,
): Partial<TablesInsert<'template'>> => {
  const update: Partial<TablesInsert<'template'>> = {};
  if (dto.name !== undefined) update.name = dto.name;
  if (dto.description !== undefined)
    update.description = dto.description ?? null;
  if (dto.isDefault !== undefined) update.is_default = dto.isDefault;
  return update;
};

export const toDbTemplateLineInsert = (
  dto: TemplateLineCreateWithoutTemplateId,
  templateId: string,
  amountEncrypted?: string | null,
): TablesInsert<'template_line'> => ({
  template_id: templateId,
  name: dto.name,
  amount: amountEncrypted ? 0 : dto.amount,
  amount_encrypted: amountEncrypted ?? null,
  kind: dto.kind,
  recurrence: dto.recurrence,
  description: dto.description,
});

export const toDbTemplateLineUpdate = (
  dto: TemplateLineUpdate,
  amountEncrypted?: string | null,
): Partial<TablesInsert<'template_line'>> => {
  const update: Partial<TablesInsert<'template_line'>> = {};
  if (dto.name !== undefined) update.name = dto.name;
  if (dto.amount !== undefined) {
    update.amount = amountEncrypted ? 0 : dto.amount;
    update.amount_encrypted = amountEncrypted ?? null;
  }
  if (dto.kind !== undefined) update.kind = dto.kind;
  if (dto.recurrence !== undefined) update.recurrence = dto.recurrence;
  if (dto.description !== undefined) update.description = dto.description;
  return update;
};
