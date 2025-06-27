// Export all schemas from schemas.ts
export {
  // Base enums
  expenseTypeSchema,
  transactionTypeSchema,

  // Budget schemas
  budgetSchema,
  budgetCreateSchema,
  budgetCreateFromOnboardingSchema,
  budgetUpdateSchema,

  // Transaction schemas
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,

  // Budget template schemas
  budgetTemplateSchema,
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,

  // Template transaction schemas
  templateTransactionSchema,
  templateTransactionCreateSchema,
  templateTransactionUpdateSchema,

  // Response schemas
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
} from './schemas';

// Export all types from types.ts
export type {
  // Base types
  ExpenseType,
  TransactionType,

  // Budget types
  Budget,
  BudgetCreate,
  BudgetCreateFromOnboarding,
  BudgetUpdate,

  // Transaction types
  Transaction,
  TransactionCreate,
  TransactionUpdate,

  // Budget template types
  BudgetTemplate,
  BudgetTemplateCreate,
  BudgetTemplateUpdate,

  // Template transaction types
  TemplateTransaction,
  TemplateTransactionCreate,
  TemplateTransactionUpdate,

  // Response types
  ErrorResponse,
  DeleteResponse,
  BudgetResponse,
  BudgetListResponse,
  BudgetDeleteResponse,
  TransactionCreateResponse,
  TransactionUpdateResponse,
  TransactionFindOneResponse,
  TransactionListResponse,
  TransactionDeleteResponse,
  BudgetTemplateResponse,
  BudgetTemplateListResponse,
  BudgetTemplateDeleteResponse,
  TemplateTransactionCreateResponse,
  TemplateTransactionUpdateResponse,
  TemplateTransactionFindOneResponse,
  TemplateTransactionListResponse,
  TemplateTransactionDeleteResponse,
  TransactionResponse,

  // User types
  UserProfile,
  UpdateProfile,
  UserProfileResponse,
  PublicInfoResponse,
  OnboardingStatusResponse,
  SuccessMessageResponse,

  // Auth types
  UserInfo,
  AuthValidationResponse,
  AuthErrorResponse,
} from './types';
