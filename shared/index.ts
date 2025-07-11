// Export all schemas from schemas.ts
export {
  // Enums
  transactionRecurrenceSchema,
  transactionKindSchema,

  // Budget schemas
  budgetSchema,
  budgetCreateSchema,
  budgetCreateFromOnboardingSchema,
  budgetUpdateSchema,
  onboardingTransactionSchema,

  // Transaction schemas
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,

  // Budget template schemas
  budgetTemplateSchema,
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,

  // Template line schemas
  templateLineSchema,
  templateLineCreateSchema,
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
  templateLineListResponseSchema,

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
} from './schemas.js';

// Export all types from types.ts
export type {
  // Enum Types
  TransactionRecurrence,
  TransactionKind,

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

  // Template line types
  TemplateLine,

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
  TemplateLineListResponse,
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
} from './schemas.js';
