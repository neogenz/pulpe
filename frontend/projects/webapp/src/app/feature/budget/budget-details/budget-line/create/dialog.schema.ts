import { z } from 'zod/v4';
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
    conversion: conversionFormSchema.nullable(),
    budgetId: z.uuid(),
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
      ...(input.conversion ?? {}),
    }),
  );

export type BudgetLineCreateFormValue = z.input<
  typeof budgetLineCreateFromFormSchema
>;
