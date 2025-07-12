// Export all schemas from schemas.ts
export {
  // Enums
  transactionRecurrenceSchema,
  transactionKindSchema,

  // Budget schemas
  budgetSchema,
  budgetCreateSchema,
  budgetCreateFromOnboardingSchema,
  budgetCreateFromTemplateSchema,
  budgetUpdateSchema,
  onboardingTransactionSchema,

  // Transaction schemas
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,

  // Budget template schemas
  budgetTemplateSchema,
  budgetTemplateCreateSchema,
  budgetTemplateCreateTransactionalSchema,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateUpdateSchema,

  // Template line schemas
  templateLineSchema,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
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
  budgetTemplateCreateResponseSchema,
  budgetTemplateCreateTransactionalResponseSchema,
  templateLineResponseSchema,
  templateLineListResponseSchema,
  templateLineDeleteResponseSchema,

  // User schemas
  userProfileSchema,
  updateProfileSchema,
  userProfileResponseSchema,
  publicInfoResponseSchema,
  onboardingStatusResponseSchema,
  successMessageResponseSchema,

  // Auth schemas
  userInfoSchema,
  authLoginSchema,
  authLoginResponseSchema,
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
  BudgetCreateFromTemplate,
  BudgetUpdate,

  // Transaction types
  Transaction,
  TransactionCreate,
  TransactionUpdate,

  // Budget template types
  BudgetTemplate,
  BudgetTemplateCreate,
  BudgetTemplateCreateTransactional,
  BudgetTemplateCreateFromOnboarding,
  BudgetTemplateUpdate,

  // Template line types
  TemplateLine,
  TemplateLineCreateWithoutTemplateId,
  TemplateLineUpdate,

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
  BudgetTemplateCreateResponse,
  BudgetTemplateCreateTransactionalResponse,
  TemplateLineResponse,
  TemplateLineListResponse,
  TemplateLineDeleteResponse,
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
  AuthLogin,
  AuthLoginResponse,
  AuthValidationResponse,
  AuthErrorResponse,
} from './schemas.js';
