import { z } from 'zod';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;
const MONTH_MIN = 1;
const MONTH_MAX = 12;

export const budgetDbEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_id: z.string().uuid().nullable(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500),
});

export type BudgetDbEntity = z.infer<typeof budgetDbEntitySchema>;
