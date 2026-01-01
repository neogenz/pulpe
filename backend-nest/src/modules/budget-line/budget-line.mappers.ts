import { BadRequestException } from '@nestjs/common';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  budgetLineCreateSchema,
} from '@pulpe/shared';
import {
  type BudgetLineRow,
  type BudgetLineInsert,
} from './entities/budget-line.entity';

/**
 * Transform database row (snake_case) to API entity (camelCase)
 */
export function toApi(budgetLineDb: BudgetLineRow): BudgetLine {
  return {
    id: budgetLineDb.id,
    budgetId: budgetLineDb.budget_id,
    templateLineId: budgetLineDb.template_line_id,
    savingsGoalId: budgetLineDb.savings_goal_id,
    name: budgetLineDb.name,
    amount: budgetLineDb.amount,
    kind: budgetLineDb.kind, // Pas de conversion - les enums sont maintenant unifiés
    recurrence: budgetLineDb.recurrence,
    isManuallyAdjusted: budgetLineDb.is_manually_adjusted,
    checkedAt: budgetLineDb.checked_at,
    createdAt: budgetLineDb.created_at,
    updatedAt: budgetLineDb.updated_at,
  };
}

/**
 * Transform multiple database rows to API entities
 */
export function toApiList(budgetLinesDb: BudgetLineRow[]): BudgetLine[] {
  return budgetLinesDb.map((budgetLine) => toApi(budgetLine));
}

/**
 * Transform create DTO (camelCase) to database insert (snake_case)
 */
export function toInsert(
  createDto: BudgetLineCreate,
  budgetId?: string,
): BudgetLineInsert {
  // Validate with Zod schema - fail fast on invalid data
  const validationResult = budgetLineCreateSchema.safeParse(createDto);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new BadRequestException(
      `Validation failed: ${firstError.path.join('.')} - ${firstError.message}`,
    );
  }

  const validatedData = validationResult.data;

  // Determine budget ID from multiple sources
  const finalBudgetId = budgetId ?? validatedData.budgetId;

  // Validate that we have a budget ID (required for DB constraint)
  if (!finalBudgetId?.trim()) {
    throw new BadRequestException(
      'Budget ID is required - must be provided either in the DTO or as parameter',
    );
  }

  return {
    budget_id: finalBudgetId,
    template_line_id: createDto.templateLineId ?? null,
    savings_goal_id: createDto.savingsGoalId ?? null,
    name: createDto.name,
    amount: createDto.amount,
    kind: createDto.kind, // Pas de conversion - les enums sont maintenant unifiés
    recurrence: createDto.recurrence,
    is_manually_adjusted: createDto.isManuallyAdjusted ?? false,
  };
}

/**
 * Transform update DTO (camelCase) to database update (snake_case)
 */
export function toUpdate(
  updateDto: BudgetLineUpdate,
): Partial<BudgetLineInsert> {
  const updateData: Partial<BudgetLineInsert> = {};

  if (updateDto.templateLineId !== undefined) {
    updateData.template_line_id = updateDto.templateLineId;
  }
  if (updateDto.savingsGoalId !== undefined) {
    updateData.savings_goal_id = updateDto.savingsGoalId;
  }
  if (updateDto.name !== undefined) {
    updateData.name = updateDto.name;
  }
  if (updateDto.amount !== undefined) {
    updateData.amount = updateDto.amount;
  }
  if (updateDto.kind !== undefined) {
    updateData.kind = updateDto.kind; // Pas de conversion - les enums sont maintenant unifiés
  }
  if (updateDto.recurrence !== undefined) {
    updateData.recurrence = updateDto.recurrence;
  }
  if (updateDto.isManuallyAdjusted !== undefined) {
    updateData.is_manually_adjusted = updateDto.isManuallyAdjusted;
  }

  return updateData;
}
