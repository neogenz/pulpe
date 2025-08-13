import { z } from 'zod';

// Define schemas inline since other modules don't have schema files
const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_default: z.boolean(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

const templateLineSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  name: z.string(),
  amount: z.number(),
  kind: z.enum(['income', 'expense', 'saving']),
  recurrence: z.enum(['fixed', 'variable', 'one_off']),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const monthlyBudgetSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  month: z.number(),
  year: z.number(),
  description: z.string(),
  user_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const budgetLineSchema = z.object({
  id: z.string().uuid(),
  budget_id: z.string().uuid(),
  name: z.string(),
  amount: z.number(),
  kind: z.enum(['income', 'expense', 'saving']),
  recurrence: z.enum(['fixed', 'variable', 'one_off']),
  template_line_id: z.string().uuid().nullable(),
  savings_goal_id: z.string().uuid().nullable(),
  is_manually_adjusted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const transactionSchema = z.object({
  id: z.string().uuid(),
  budget_id: z.string().uuid(),
  name: z.string(),
  amount: z.number(),
  kind: z.enum(['income', 'expense', 'saving']),
  transaction_date: z.string(),
  category: z.string().nullable(),
  is_out_of_budget: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Schema for savings goals
export const savingsGoalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  target_amount: z.number(),
  target_date: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Complete export data schema
export const exportDataSchema = z.object({
  version: z.literal('1.0.0'), // Version for future compatibility
  exported_at: z.string().datetime(),
  user_id: z.string().uuid(),
  data: z.object({
    templates: z.array(templateSchema),
    template_lines: z.array(templateLineSchema),
    monthly_budgets: z.array(monthlyBudgetSchema),
    budget_lines: z.array(budgetLineSchema),
    transactions: z.array(transactionSchema),
    savings_goals: z.array(savingsGoalSchema),
  }),
  metadata: z.object({
    total_templates: z.number(),
    total_budgets: z.number(),
    total_transactions: z.number(),
    total_savings_goals: z.number(),
    date_range: z.object({
      oldest_budget: z.string().nullable(),
      newest_budget: z.string().nullable(),
    }),
  }),
});

export type ExportData = z.infer<typeof exportDataSchema>;
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
