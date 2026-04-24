import { z } from 'zod/v4';
import {
  transactionKindSchema,
  transactionRecurrenceSchema,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Validates the form-derived portion of a BudgetLine update.
 *
 * Source of truth for the outgoing DTO: shared/schemas.ts (budgetLineUpdateSchema).
 * The host attaches `id`, `templateLineId`, and `savingsGoalId` from the source
 * BudgetLine after parsing — these are server-trusted identity fields, not
 * user-edited values.
 *
 * Note: the edit dialog has no isChecked toggle — checkedAt is owned by a
 * separate toggle endpoint, mirroring transactionUpdateFromFormSchema.
 */
export const budgetLineUpdateFromFormSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    amount: z.number().positive(),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    conversion: conversionFormSchema.nullable(),
  })
  .transform((input) => ({
    name: input.name,
    amount: input.amount,
    kind: input.kind,
    recurrence: input.recurrence,
    isManuallyAdjusted: true,
    ...(input.conversion ?? {}),
  }));

export type BudgetLineUpdateFormValue = z.input<
  typeof budgetLineUpdateFromFormSchema
>;
