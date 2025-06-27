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
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500),
  userId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const budgetCreateSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
});

// Schema for transactions during onboarding (without budgetId since budget doesn't exist yet)
export const onboardingTransactionSchema = z.object({
  amount: z.number().positive(),
  type: transactionTypeSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  expenseType: expenseTypeSchema,
  isRecurring: z.boolean(),
});

export const budgetCreateFromOnboardingSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
  transactions: z.array(onboardingTransactionSchema),
  monthlyIncome: z.number().min(0).default(0).optional(),
  housingCosts: z.number().min(0).default(0).optional(),
  healthInsurance: z.number().min(0).default(0).optional(),
  leasingCredit: z.number().min(0).default(0).optional(),
  phonePlan: z.number().min(0).default(0).optional(),
  transportCosts: z.number().min(0).default(0).optional(),
});

export const budgetUpdateSchema = z.object({
  description: z.string().optional(),
  month: z.number().optional(),
  year: z.number().optional(),
});

// Transaction schemas
export const transactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string().uuid().optional(),
  budgetId: z.string().uuid(),
  expenseType: expenseTypeSchema,
  isRecurring: z.boolean(),
});

export const transactionCreateSchema = z.object({
  amount: z.number().positive(),
  type: transactionTypeSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  expenseType: expenseTypeSchema,
  isRecurring: z.boolean(),
  budgetId: z.string().uuid().optional(),
});

export const transactionUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  type: transactionTypeSchema.optional(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  expenseType: expenseTypeSchema.optional(),
  isRecurring: z.boolean().optional(),
});

// Budget template schemas
export const budgetTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  category: z.string().min(1).max(50).trim().optional(),
  userId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const budgetTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(500).trim().optional(),
  category: z.string().min(1).max(50).trim().optional(),
  isDefault: z.boolean().default(false),
});

export const budgetTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  category: z.string().min(1).max(50).trim().optional(),
  isDefault: z.boolean().optional(),
});

// Template transaction schemas
export const templateTransactionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expenseType: expenseTypeSchema,
  description: z.string().max(500).trim(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const templateTransactionCreateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expenseType: expenseTypeSchema,
  description: z.string().max(500).trim(),
});

export const templateTransactionUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  type: transactionTypeSchema.optional(),
  expenseType: expenseTypeSchema.optional(),
  description: z.string().max(500).trim().optional(),
});

// Response schemas with proper typing
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.string().optional(),
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

// Transaction response schemas for operation-specific types
export const transactionResponseSchema = z.object({
  success: z.literal(true),
  data: transactionSchema,
});

export const transactionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(transactionSchema),
});

export const transactionDeleteResponseSchema = deleteResponseSchema;

// Budget template response schemas
export const budgetTemplateResponseSchema = z.object({
  success: z.literal(true),
  data: budgetTemplateSchema,
});

export const budgetTemplateListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetTemplateSchema),
});

export const budgetTemplateDeleteResponseSchema = deleteResponseSchema;

// Template transaction response schemas
export const templateTransactionResponseSchema = z.object({
  success: z.literal(true),
  data: templateTransactionSchema,
});

export const templateTransactionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(templateTransactionSchema),
});

export const templateTransactionDeleteResponseSchema = deleteResponseSchema;

// User schemas
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
});

export const userProfileResponseSchema = z.object({
  success: z.literal(true),
  user: userProfileSchema,
});

export const publicInfoResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  authenticated: z.boolean(),
});

export const onboardingStatusResponseSchema = z.object({
  success: z.literal(true),
  onboardingCompleted: z.boolean(),
});

export const successMessageResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

// Auth schemas
export const userInfoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

export const authValidationResponseSchema = z.object({
  success: z.literal(true),
  user: userInfoSchema,
});

export const authErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});
