import { z } from 'zod';

// Constants
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;
const MONTH_MIN = 1;
const MONTH_MAX = 12;

// Enums
export const transactionRecurrenceSchema = z.enum([
  'fixed',
  'variable',
  'one_off',
]);
export type TransactionRecurrence = z.infer<typeof transactionRecurrenceSchema>;
export const transactionKindSchema = z.enum([
  'expense',
  'income',
  'saving',
  'exceptional_income',
]);
export type TransactionKind = z.infer<typeof transactionKindSchema>;

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
export type Budget = z.infer<typeof budgetSchema>;

export const budgetCreateSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
  templateId: z.string().uuid(),
});
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;

// Schema for transactions during onboarding (without budgetId since budget doesn't exist yet)
export const onboardingTransactionSchema = z.object({
  amount: z.number().positive(),
  type: transactionKindSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  expenseType: transactionRecurrenceSchema,
  isRecurring: z.boolean(),
});

// Schema for creating template from onboarding data
export const budgetTemplateCreateFromOnboardingSchema = z.object({
  name: z.string().min(1).max(100).trim().default('Mois Standard'),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().default(true),
  monthlyIncome: z.number().min(0).default(0).optional(),
  housingCosts: z.number().min(0).default(0).optional(),
  healthInsurance: z.number().min(0).default(0).optional(),
  leasingCredit: z.number().min(0).default(0).optional(),
  phonePlan: z.number().min(0).default(0).optional(),
  transportCosts: z.number().min(0).default(0).optional(),
  customTransactions: z.array(onboardingTransactionSchema).default([]),
});
export type BudgetTemplateCreateFromOnboarding = z.infer<
  typeof budgetTemplateCreateFromOnboardingSchema
>;

// Schema for creating budget from template
export const budgetCreateFromTemplateSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
  templateId: z.string().uuid(),
});
export type BudgetCreateFromTemplate = z.infer<
  typeof budgetCreateFromTemplateSchema
>;

// Legacy schema - kept for backward compatibility
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
export type BudgetCreateFromOnboarding = z.infer<
  typeof budgetCreateFromOnboardingSchema
>;

export const budgetUpdateSchema = z.object({
  description: z.string().optional(),
  month: z.number().optional(),
  year: z.number().optional(),
});
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

// Transaction schemas
export const transactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionKindSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string().uuid().optional(),
  budgetId: z.string().uuid(),
  expenseType: transactionRecurrenceSchema,
  isRecurring: z.boolean(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionCreateSchema = z.object({
  amount: z.number().positive(),
  type: transactionKindSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  expenseType: transactionRecurrenceSchema,
  isRecurring: z.boolean(),
  budgetId: z.string().uuid().optional(),
});
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

export const transactionUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  type: transactionKindSchema.optional(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  expenseType: transactionRecurrenceSchema.optional(),
  isRecurring: z.boolean().optional(),
});
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

// Budget template schemas
export const budgetTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  userId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BudgetTemplate = z.infer<typeof budgetTemplateSchema>;

// Template line schemas
export const templateLineSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TemplateLine = z.infer<typeof templateLineSchema>;

export const templateLineCreateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
});

// Template line create without templateId (for batch creation)
export const templateLineCreateWithoutTemplateIdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
});
export type TemplateLineCreateWithoutTemplateId = z.infer<
  typeof templateLineCreateWithoutTemplateIdSchema
>;

// Budget template schemas (after template line schemas)
export const budgetTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(500).trim().optional(),
  isDefault: z.boolean().default(false),
  lines: z.array(templateLineCreateWithoutTemplateIdSchema).default([]),
});
export type BudgetTemplateCreate = z.infer<typeof budgetTemplateCreateSchema>;

// Schema for transactional template creation using RPC
export const budgetTemplateCreateTransactionalSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().default(false),
  lines: z.array(templateLineCreateWithoutTemplateIdSchema).default([]),
});
export type BudgetTemplateCreateTransactional = z.infer<
  typeof budgetTemplateCreateTransactionalSchema
>;

export const budgetTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().optional(),
});
export type BudgetTemplateUpdate = z.infer<typeof budgetTemplateUpdateSchema>;

// Template line update schema
export const templateLineUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  recurrence: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
});
export type TemplateLineUpdate = z.infer<typeof templateLineUpdateSchema>;

// Legacy schema for backward compatibility
export const templateTransactionUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  type: transactionKindSchema.optional(),
  expenseType: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
});

// Response schemas with proper typing
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const deleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

// Specific response schemas for strict validation
export const budgetResponseSchema = z.object({
  success: z.literal(true),
  data: budgetSchema,
});
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;

export const budgetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetSchema),
});
export type BudgetListResponse = z.infer<typeof budgetListResponseSchema>;

export const budgetDeleteResponseSchema = deleteResponseSchema;
export type BudgetDeleteResponse = z.infer<typeof budgetDeleteResponseSchema>;

// Transaction response schemas for operation-specific types
export const transactionResponseSchema = z.object({
  success: z.literal(true),
  data: transactionSchema,
});
export type TransactionCreateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionUpdateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionFindOneResponse = z.infer<
  typeof transactionResponseSchema
>;

export const transactionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(transactionSchema),
});
export type TransactionListResponse = z.infer<
  typeof transactionListResponseSchema
>;

export const transactionDeleteResponseSchema = deleteResponseSchema;
export type TransactionDeleteResponse = z.infer<
  typeof transactionDeleteResponseSchema
>;

// Budget template response schemas
export const budgetTemplateResponseSchema = z.object({
  success: z.literal(true),
  data: budgetTemplateSchema,
});
export type BudgetTemplateResponse = z.infer<
  typeof budgetTemplateResponseSchema
>;

export const budgetTemplateListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetTemplateSchema),
});
export type BudgetTemplateListResponse = z.infer<
  typeof budgetTemplateListResponseSchema
>;

export const budgetTemplateDeleteResponseSchema = deleteResponseSchema;
export type BudgetTemplateDeleteResponse = z.infer<
  typeof budgetTemplateDeleteResponseSchema
>;

// Response schema for template creation that includes created lines
export const budgetTemplateCreateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    template: budgetTemplateSchema,
    lines: z.array(templateLineSchema),
  }),
});
export type BudgetTemplateCreateResponse = z.infer<
  typeof budgetTemplateCreateResponseSchema
>;

// Response schema for transactional RPC function
export const budgetTemplateCreateTransactionalResponseSchema = z.object({
  success: z.literal(true),
  template: budgetTemplateSchema,
  lines_created: z.number(),
});
export type BudgetTemplateCreateTransactionalResponse = z.infer<
  typeof budgetTemplateCreateTransactionalResponseSchema
>;

// Template line response schemas
export const templateLineResponseSchema = z.object({
  success: z.literal(true),
  data: templateLineSchema,
});
export type TemplateLineResponse = z.infer<typeof templateLineResponseSchema>;

export const templateLineListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(templateLineSchema),
});
export type TemplateLineListResponse = z.infer<
  typeof templateLineListResponseSchema
>;

export const templateLineDeleteResponseSchema = deleteResponseSchema;
export type TemplateLineDeleteResponse = z.infer<
  typeof templateLineDeleteResponseSchema
>;

// Legacy generic type - prefer operation-specific types above
export type TransactionResponse = {
  success: true;
  data?: Transaction | Transaction[];
};

// User schemas
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const userProfileResponseSchema = z.object({
  success: z.literal(true),
  user: userProfileSchema,
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

export const publicInfoResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  authenticated: z.boolean(),
});
export type PublicInfoResponse = z.infer<typeof publicInfoResponseSchema>;

export const onboardingStatusResponseSchema = z.object({
  success: z.literal(true),
  onboardingCompleted: z.boolean(),
});
export type OnboardingStatusResponse = z.infer<
  typeof onboardingStatusResponseSchema
>;

export const successMessageResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type SuccessMessageResponse = z.infer<
  typeof successMessageResponseSchema
>;

// Auth schemas
export const userInfoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
export type UserInfo = z.infer<typeof userInfoSchema>;

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type AuthLogin = z.infer<typeof authLoginSchema>;

export const authLoginResponseSchema = z.object({
  success: z.literal(true),
  user: userInfoSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;

export const authValidationResponseSchema = z.object({
  success: z.literal(true),
  user: userInfoSchema,
});
export type AuthValidationResponse = z.infer<
  typeof authValidationResponseSchema
>;

export const authErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;
