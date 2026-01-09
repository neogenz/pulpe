import {
  type Budget,
  type BudgetCreate,
  type BudgetUpdate,
} from 'pulpe-shared';
import { Tables, TablesInsert } from '@/types/database.types';

/**
 * Transform database row (snake_case) to API entity (camelCase)
 */
export function toApi(
  budgetDb:
    | Tables<'monthly_budget'>
    | (Tables<'monthly_budget'> & { remaining: number }),
): Budget {
  const baseEntity: Budget = {
    id: budgetDb.id,
    createdAt: budgetDb.created_at,
    updatedAt: budgetDb.updated_at,
    userId: budgetDb.user_id ?? undefined,
    templateId: budgetDb.template_id,
    month: budgetDb.month,
    year: budgetDb.year,
    description: budgetDb.description,
    endingBalance: budgetDb.ending_balance ?? undefined,
  };

  // Add remaining if present in enriched budget
  if ('remaining' in budgetDb) {
    baseEntity.remaining = budgetDb.remaining;
  }

  return baseEntity;
}

/**
 * Transforme plusieurs entités DB vers modèles API
 * Fonctionne avec des budgets enrichis ou normaux
 */
export function toApiList(
  budgetsDb: (
    | Tables<'monthly_budget'>
    | (Tables<'monthly_budget'> & { remaining: number })
  )[],
): Budget[] {
  return budgetsDb.map((budgetDb) => toApi(budgetDb));
}

/**
 * Transform create DTO (camelCase) to database insert (snake_case)
 */
export function toInsert(
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
export function toUpdate(
  updateDto: BudgetUpdate,
): Partial<TablesInsert<'monthly_budget'>> {
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
