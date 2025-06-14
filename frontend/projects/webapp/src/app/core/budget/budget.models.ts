import { z } from 'zod/v4';

// Zod Schemas
export const BudgetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  plannedAmount: z.number(),
  actualAmount: z.number(),
  type: z.union([
    z.literal('income'),
    z.literal('expense'),
    z.literal('savings'),
  ]),
});

export const MonthlyBudgetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  month: z.string(),
  year: z.string(),
  categories: z.array(BudgetCategorySchema).readonly(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BudgetSummarySchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  totalSavings: z.number(),
  remainingBudget: z.number(),
});

export const CreateOnboardingBudgetRequestSchema = z.object({
  monthlyIncome: z.number().positive(),
  housingCosts: z.number().nonnegative(),
  healthInsurance: z.number().nonnegative(),
  leasingCredit: z.number().nonnegative(),
  phonePlan: z.number().nonnegative(),
  transportCosts: z.number().nonnegative(),
  firstName: z.string().min(1),
  email: z.string().email(),
});

export const CreateBudgetResponseSchema = z.object({
  budget: MonthlyBudgetSchema,
  message: z.string(),
});

// Inferred Types (equivalent to your original interfaces)
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;
export type MonthlyBudget = z.infer<typeof MonthlyBudgetSchema>;
export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;
export type CreateOnboardingBudgetRequest = z.infer<
  typeof CreateOnboardingBudgetRequestSchema
>;
export type CreateBudgetResponse = z.infer<typeof CreateBudgetResponseSchema>;
