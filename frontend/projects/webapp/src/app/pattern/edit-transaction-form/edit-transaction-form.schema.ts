import { z } from 'zod/v4';
import {
  transactionKindSchema,
  type TransactionCreate,
  type TransactionUpdate,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Source of truth for the outgoing TransactionCreate / TransactionUpdate DTOs:
 * shared/schemas.ts (transactionCreateSchema / transactionUpdateSchema).
 *
 * Form-value type = z.input<typeof …FromFormSchema>.
 * DTO type        = z.output<typeof …FromFormSchema>.
 *
 * Add any new create/update field here AND in shared/schemas.ts.
 */

const baseFormFields = {
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  transactionDate: z.iso.datetime({ offset: true }),
  category: z.string().max(100).trim().nullable(),
  conversion: conversionFormSchema.nullable(),
};

export const transactionCreateFromFormSchema = z
  .object({
    ...baseFormFields,
    isChecked: z.boolean(),
    budgetId: z.uuid(),
    budgetLineId: z.uuid().nullable(),
  })
  .transform(
    (input): TransactionCreate => ({
      budgetId: input.budgetId,
      budgetLineId: input.budgetLineId,
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      transactionDate: input.transactionDate,
      category: input.category,
      checkedAt: input.isChecked ? new Date().toISOString() : null,
      ...(input.conversion ?? {}),
    }),
  );

export type TransactionCreateFormValue = z.input<
  typeof transactionCreateFromFormSchema
>;

/**
 * Update path: transactionUpdateSchema has no checkedAt, budgetId, budgetLineId.
 * toggle-check is a separate endpoint.
 */
export const transactionUpdateFromFormSchema = z
  .object(baseFormFields)
  .transform(
    (input): TransactionUpdate => ({
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      transactionDate: input.transactionDate,
      category: input.category,
      ...(input.conversion ?? {}),
    }),
  );

export type TransactionUpdateFormValue = z.input<
  typeof transactionUpdateFromFormSchema
>;
