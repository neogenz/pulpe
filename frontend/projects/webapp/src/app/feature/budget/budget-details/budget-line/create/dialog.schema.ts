import * as z from 'zod';
import {
  transactionKindSchema,
  transactionRecurrenceSchema,
  type BudgetLineCreate,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Source of truth for the outgoing BudgetLineCreate DTO:
 * shared/schemas.ts (budgetLineCreateSchema).
 *
 * Form-value type = z.input<typeof budgetLineCreateFromFormSchema>.
 * DTO type        = z.output<typeof budgetLineCreateFromFormSchema>.
 */

export const budgetLineCreateFromFormSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    amount: z.number().positive(),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    isChecked: z.boolean(),
    tagIds: z.array(z.uuid()).optional(),
    conversion: conversionFormSchema.nullable(),
    budgetId: z.uuid(),
    savingsGoalId: z.uuid().nullable().optional(),
    /** PUL-329 v2 — objectif d'où ce revenu prévu sera tiré. */
    sourceSavingsGoalId: z.uuid().nullable().optional(),
  })
  .transform(
    (input): BudgetLineCreate => ({
      budgetId: input.budgetId,
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      recurrence: input.recurrence,
      isManuallyAdjusted: true,
      checkedAt: input.isChecked ? new Date().toISOString() : null,
      tagIds: input.tagIds,
      savingsGoalId: input.savingsGoalId,
      // Omis plutôt que `null` : le schéma de création est strict et n'accepte
      // pas la valeur nulle sur ce champ — l'absence dit déjà « pas de source ».
      ...(input.sourceSavingsGoalId
        ? { sourceSavingsGoalId: input.sourceSavingsGoalId }
        : {}),
      ...(input.conversion ?? {}),
    }),
  );

export type BudgetLineCreateFormValue = z.input<
  typeof budgetLineCreateFromFormSchema
>;
