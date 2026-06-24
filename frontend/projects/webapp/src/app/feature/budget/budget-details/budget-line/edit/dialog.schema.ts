import { z } from 'zod/v4';
import {
  transactionKindSchema,
  transactionRecurrenceSchema,
  type BudgetLineUpdate,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Validates the form-derived portion of a BudgetLine update.
 *
 * Source of truth for the outgoing DTO: shared/schemas.ts (budgetLineUpdateSchema).
 * The host attaches `id` and `templateLineId` from the source BudgetLine after
 * parsing — these are server-trusted identity fields, not user-edited values.
 * `savingsGoalId` IS user-editable (CA26): it comes from the savings-goal picker
 * and is parsed here so an explicit null (untag) wins over the source value.
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
    savingsGoalId: z.uuid().nullable().optional(),
    conversion: conversionFormSchema.nullable(),
  })
  .transform(
    (input): Partial<BudgetLineUpdate> => ({
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      recurrence: input.recurrence,
      savingsGoalId: input.savingsGoalId,
      isManuallyAdjusted: true,
      ...(input.conversion ?? {}),
    }),
  );

export type BudgetLineUpdateFormValue = z.input<
  typeof budgetLineUpdateFromFormSchema
>;
