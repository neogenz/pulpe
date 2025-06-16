import { z } from "zod";

// Constants
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;
const MONTH_MIN = 1;
const MONTH_MAX = 12;

// Enums
export const expenseTypeSchema = z.enum(["fixed", "variable"]);
export const transactionTypeSchema = z.enum(["expense", "income", "saving"]);

// Budget schemas
export const budgetSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string().uuid().nullable(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
});

export const budgetCreateSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
});

export const budgetCreateFromOnboardingSchema = budgetCreateSchema.extend({
  monthlyIncome: z.number().min(0).optional().default(0),
  housingCosts: z.number().min(0).optional().default(0),
  healthInsurance: z.number().min(0).optional().default(0),
  leasingCredit: z.number().min(0).optional().default(0),
  phonePlan: z.number().min(0).optional().default(0),
  transportCosts: z.number().min(0).optional().default(0),
});

export const budgetUpdateSchema = z
  .object({
    month: z.number().int().min(MONTH_MIN).max(MONTH_MAX).optional(),
    year: z.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
    description: z.string().min(1).max(500).trim().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Au moins un champ doit être fourni pour la mise à jour"
  );

// Transaction schemas
export const transactionSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string().uuid().nullable(),
  budgetId: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expenseType: expenseTypeSchema,
  name: z.string().min(1).max(500).trim(),
  description: z.string().min(1).max(500).trim().nullable(),
  isRecurring: z.boolean().default(false),
});

export const transactionCreateSchema = z.object({
  budgetId: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expenseType: expenseTypeSchema,
  name: z.string().min(1).max(500).trim(),
  description: z.string().min(1).max(500).trim().optional().nullable(),
  isRecurring: z.boolean().default(false),
});

export const transactionUpdateSchema = z
  .object({
    budgetId: z.string().uuid().optional(),
    amount: z.number().positive().optional(),
    type: transactionTypeSchema.optional(),
    expenseType: expenseTypeSchema.optional(),
    name: z.string().min(1).max(500).trim().optional(),
    description: z.string().min(1).max(500).trim().optional().nullable(),
    isRecurring: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Au moins un champ doit être fourni pour la mise à jour"
  );

// Generic response schemas
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema.optional(),
    items: z.array(dataSchema).optional(),
  }) as z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodOptional<T>;
    items: z.ZodOptional<z.ZodArray<T>>;
  }>;

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.array(z.string()).optional(),
});

export const deleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

// Specific response schemas for strict validation
export const budgetResponseSchema = z.object({
  success: z.literal(true),
  data: budgetSchema,
});

export const budgetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetSchema),
});

export const budgetDeleteResponseSchema = deleteResponseSchema;
