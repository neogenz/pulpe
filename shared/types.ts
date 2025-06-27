import type { z } from "zod";
import type {
  budgetSchema,
  budgetCreateSchema,
  budgetCreateFromOnboardingSchema,
  budgetUpdateSchema,
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  budgetTemplateSchema,
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,
  templateTransactionSchema,
  templateTransactionCreateSchema,
  templateTransactionUpdateSchema,
  expenseTypeSchema,
  transactionTypeSchema,
  errorResponseSchema,
  deleteResponseSchema,
  budgetResponseSchema,
  budgetListResponseSchema,
  budgetDeleteResponseSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
  budgetTemplateResponseSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateDeleteResponseSchema,
  templateTransactionResponseSchema,
  templateTransactionListResponseSchema,
  templateTransactionDeleteResponseSchema,
  // User schemas
  userProfileSchema,
  updateProfileSchema,
  userProfileResponseSchema,
  publicInfoResponseSchema,
  onboardingStatusResponseSchema,
  successMessageResponseSchema,
  // Auth schemas
  userInfoSchema,
  authValidationResponseSchema,
  authErrorResponseSchema,
} from "./schemas";

// Budget types
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;
export type BudgetCreateFromOnboarding = z.infer<
  typeof budgetCreateFromOnboardingSchema
>;
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

// Transaction types
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type ExpenseType = z.infer<typeof expenseTypeSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;

// Budget template types
export type BudgetTemplate = z.infer<typeof budgetTemplateSchema>;
export type BudgetTemplateCreate = z.infer<typeof budgetTemplateCreateSchema>;
export type BudgetTemplateUpdate = z.infer<typeof budgetTemplateUpdateSchema>;

// Template transaction types
export type TemplateTransaction = z.infer<typeof templateTransactionSchema>;
export type TemplateTransactionCreate = z.infer<
  typeof templateTransactionCreateSchema
>;
export type TemplateTransactionUpdate = z.infer<
  typeof templateTransactionUpdateSchema
>;

// Response types
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

// Strict response types with Zod validation
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
export type BudgetListResponse = z.infer<typeof budgetListResponseSchema>;
export type BudgetDeleteResponse = z.infer<typeof budgetDeleteResponseSchema>;

// Operation-specific transaction response types for type safety
export type TransactionCreateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionUpdateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionFindOneResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionListResponse = z.infer<
  typeof transactionListResponseSchema
>;
export type TransactionDeleteResponse = z.infer<
  typeof transactionDeleteResponseSchema
>;

// Budget template response types
export type BudgetTemplateResponse = z.infer<
  typeof budgetTemplateResponseSchema
>;
export type BudgetTemplateListResponse = z.infer<
  typeof budgetTemplateListResponseSchema
>;
export type BudgetTemplateDeleteResponse = z.infer<
  typeof budgetTemplateDeleteResponseSchema
>;

// Template transaction response types
export type TemplateTransactionCreateResponse = z.infer<
  typeof templateTransactionResponseSchema
>;
export type TemplateTransactionUpdateResponse = z.infer<
  typeof templateTransactionResponseSchema
>;
export type TemplateTransactionFindOneResponse = z.infer<
  typeof templateTransactionResponseSchema
>;
export type TemplateTransactionListResponse = z.infer<
  typeof templateTransactionListResponseSchema
>;
export type TemplateTransactionDeleteResponse = z.infer<
  typeof templateTransactionDeleteResponseSchema
>;

// Legacy generic type - prefer operation-specific types above
export type TransactionResponse = {
  success: true;
  data?: Transaction | Transaction[];
};

// User types
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
export type PublicInfoResponse = z.infer<typeof publicInfoResponseSchema>;
export type OnboardingStatusResponse = z.infer<
  typeof onboardingStatusResponseSchema
>;
export type SuccessMessageResponse = z.infer<
  typeof successMessageResponseSchema
>;

// Auth types
export type UserInfo = z.infer<typeof userInfoSchema>;
export type AuthValidationResponse = z.infer<
  typeof authValidationResponseSchema
>;
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;
