import { transactionKindSchema } from 'pulpe-shared';
import { z } from 'zod';

export const financialEntrySchema = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  transactionDate: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  checkedAt: z.string().datetime().nullable().optional(),
  rollover: z.object({
    sourceBudgetId: z.string().uuid().optional(),
  }),
});
export type FinancialEntryModel = z.infer<typeof financialEntrySchema>;
