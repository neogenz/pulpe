import { z } from 'zod/v4';
import {
  MAX_TAGS_PER_TRANSACTION,
  transactionKindSchema,
  type TransactionCreate,
} from 'pulpe-shared';

import { conversionFormSchema } from '@core/currency';

export const transactionFormDataSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  tagIds: z.array(z.uuid()).max(MAX_TAGS_PER_TRANSACTION),
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
    ({ isChecked, conversion, tagIds, ...input }): TransactionCreate => ({
      ...input,
      tagIds: tagIds.length ? tagIds : undefined,
      checkedAt: isChecked ? new Date().toISOString() : null,
      ...(conversion ?? {}),
    }),
  );
