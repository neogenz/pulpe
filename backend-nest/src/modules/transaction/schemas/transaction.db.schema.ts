import { z } from 'zod';
import { expenseTypeSchema, transactionTypeSchema } from '@pulpe/shared';

// Database entity schemas for runtime validation
export const transactionDbEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_id: z.string().uuid().nullable(),
  budget_id: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expense_type: expenseTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  is_recurring: z.boolean(),
});

export type TransactionDbEntity = z.infer<typeof transactionDbEntitySchema>;
