import { z } from 'zod';

export const budgetTemplateDbEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  category: z.string().min(1).max(50).nullable(),
  is_default: z.boolean().nullable(),
});

export type BudgetTemplateDbEntity = z.infer<
  typeof budgetTemplateDbEntitySchema
>;
