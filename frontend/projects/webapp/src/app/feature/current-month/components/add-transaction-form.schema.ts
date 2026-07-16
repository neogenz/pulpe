import { z } from 'zod/v4';
import { transactionKindSchema, type TransactionCreate } from 'pulpe-shared';

import { conversionFormSchema } from '@core/currency';

export const transactionFormDataSchema = z.strictObject({
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  category: z.string().max(50).trim().nullable(),
  isChecked: z.boolean(),
  conversion: conversionFormSchema.nullable(),
});

export type TransactionFormData = z.input<typeof transactionFormDataSchema>;

export const transactionCreateFromQuickFormSchema = transactionFormDataSchema
  .extend({
    budgetId: z.uuid(),
    transactionDate: z.iso.datetime({ offset: true }),
  })
  .transform(
    ({ isChecked, conversion, ...input }): TransactionCreate => ({
      ...input,
      checkedAt: isChecked ? new Date().toISOString() : null,
      ...(conversion ?? {}),
    }),
  );
