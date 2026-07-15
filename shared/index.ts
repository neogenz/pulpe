// Export all schemas from schemas.ts
export {
  // Constants
  PAY_DAY_MIN,
  PAY_DAY_MAX,

  // Enums
  transactionRecurrenceSchema,
  transactionKindSchema,
  priorityLevelSchema,
  savingsGoalStatusSchema,

  // Budget schemas
  budgetSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetGenerateSchema,
  budgetGenerateResponseSchema,
  onboardingTransactionSchema,

  // Transaction schemas
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  TRANSACTION_SEARCH_QUERY_MIN_LENGTH,
  TRANSACTION_SEARCH_QUERY_MAX_LENGTH,
  transactionSearchQuerySchema,
  transactionSearchResultSchema,
  transactionSearchResponseSchema,

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

  // Response schemas
  errorResponseSchema,
  deleteResponseSchema,
  budgetResponseSchema,
  budgetListResponseSchema,
  budgetExistsResponseSchema,
  budgetDeleteResponseSchema,
  budgetSummarySchema,
  budgetDetailsResponseSchema,
  budgetWithDetailsSchema,
  budgetExportResponseSchema,
  budgetFieldsEnum,
  VALID_SPARSE_FIELDS,
  listBudgetsQuerySchema,
  budgetSparseSchema,
  budgetSparseListResponseSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
  transactionPostponeResponseSchema,
  budgetTemplateResponseSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateDeleteResponseSchema,
  budgetTemplateCreateResponseSchema,
  budgetTemplateCreateTransactionalResponseSchema,
  templateUsageResponseSchema,
  templateLineResponseSchema,
  templateLineListResponseSchema,
  templateLineDeleteResponseSchema,
  templateLineUpdateWithIdSchema,
  templateLinesBulkOperationsSchema,
  templateLinesBulkOperationsResponseSchema,

  // Savings Goal schemas
  savingsGoalSchema,
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsGoalResponseSchema,
  savingsGoalListResponseSchema,
  savingsGoalDeleteResponseSchema,
  savingsGoalPaceStatusSchema,
  savingsGoalProgressSchema,
  savingsGoalProgressResponseSchema,
  savingsGoalContributionSchema,
  savingsGoalContributionsResponseSchema,
  savingsGoalPlanMonthSchema,
  savingsGoalPlanApplySchema,
  savingsGoalPlanApplyResponseSchema,
  MAX_SAVINGS_GOAL_PLAN_PERIODS,
  MAX_PLAN_ADJUSTMENTS,

  // Tag schemas (PUL-18)
  MAX_TAGS_PER_TRANSACTION,
  tagSchema,
  tagCreateSchema,
  tagUpdateSchema,
  tagResponseSchema,
  tagListResponseSchema,
  tagHistoryMonthsSchema,
  tagHistoryQuerySchema,
  tagHistoryMonthSchema,
  tagHistorySchema,
  tagHistoryResponseSchema,
  tagDeleteResponseSchema,

  // Budget Line schemas
  budgetLineSchema,
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  budgetLineResponseSchema,
  budgetLineListResponseSchema,
  budgetLineDeleteResponseSchema,
  budgetLinePostponeResponseSchema,

  // Budget Line Spread schemas (PUL-17)
  budgetLineSpreadCreateSchema,
  budgetLineSpreadResponseSchema,
  spreadFromExistingPeriodSchema,
  budgetLineSpreadFromLineCreateSchema,
  transactionSpreadFromTxnCreateSchema,
  spreadOccurrenceSchema,
  spreadOccurrencesResponseSchema,

  // Currency schemas
  supportedCurrencySchema,
  SUPPORTED_CURRENCIES,
  currencyRateQuerySchema,
  currencyRateResponseSchema,
  exchangeRateWire,
  exchangeRateWirePositive,

  // User schemas
  userProfileSchema,
  updateProfileSchema,
  userProfileResponseSchema,
  publicInfoResponseSchema,
  deleteAccountResponseSchema,
  payDayOfMonthSchema,
  updateUserSettingsSchema,
  userSettingsSchema,
  userSettingsResponseSchema,

  // Auth schemas
  userInfoSchema,
  authLoginSchema,
  authLoginResponseSchema,
  authValidationResponseSchema,
  authErrorResponseSchema,

  // Demo mode schemas
  demoSessionCreateSchema,
  demoSessionResponseSchema,
  demoCleanupResponseSchema,

  // Encryption schemas — requests
  encryptionValidateKeyRequestSchema,
  encryptionRecoverRequestSchema,
  encryptionVerifyRecoveryKeyRequestSchema,
  encryptionChangePinRequestSchema,
  // Encryption schemas — responses
  encryptionVaultStatusResponseSchema,
  encryptionSaltResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionRecoverResponseSchema,
  encryptionChangePinResponseSchema,

  // App version (force update gate)
  appVersionResponseSchema,

  // What's new (iOS release notes feed)
  whatsNewEntrySchema,
  whatsNewResponseSchema,
  whatsNewQuerySchema,
} from './schemas.js';

// Export error codes
export { API_ERROR_CODES, type ApiErrorCode } from './src/error-codes.js';

// Export HTTP header constants
export { REQUEST_ID_HEADER } from './src/http-headers.js';

// Export feature flag keys
export {
  FEATURE_FLAGS,
  ANALYTICS_PROPERTIES,
  ANALYTICS_EVENTS,
  type FeatureFlagKey,
  type AnalyticsEventName,
} from './src/feature-flags.js';

// Export response schema factories
export {
  createSuccessResponse,
  createListResponse,
} from './src/api-response.js';

// Export calculators
export { BudgetFormulas } from './src/calculators/index.js';
export { splitTotalPreserving } from './src/calculators/index.js';
export {
  PACE_TOLERANCE_PERCENT,
  MAX_ESTIMATED_HORIZON_MONTHS,
  calculatePaceStatus,
  computeSavingsGoalProgress,
  type LinkedSavingLine,
  type LinkedSavingTransaction,
  type SavingsGoalProgressInput,
  type SavingsGoalProgressResult,
} from './src/calculators/index.js';
export {
  buildSavingsGoalTimeline,
  simulateSavingsPlan,
  redistributeRemainingEffort,
  allocateMonthAmountToLines,
  isContributivePlanMonth,
  isOpenPlanMonth,
  type SavingsPlanMonthState,
  type SavingsPlanLine,
  type SavingsPlanTimelineMonth,
  type SavingsPlanAdjustment,
  type SavingsPlanSimulatedMonth,
  type SavingsPlanSimulationResult,
  type RedistributeRemainingEffortResult,
  type AllocatableLine,
} from './src/calculators/index.js';

// Export budget period utilities
export {
  getBudgetPeriodForDate,
  isInCurrentBudgetPeriod,
  compareBudgetPeriods,
  isPastBudgetPeriod,
  getBudgetPeriodDates,
  formatBudgetPeriod,
  periodIndex,
  periodFromIndex,
  parseIsoDateLocal,
  type BudgetPeriod,
  type BudgetPeriodDates,
} from './src/calculators/index.js';

// Export currency display metadata
export {
  CURRENCY_METADATA,
  type CurrencyMetadataEntry,
} from './src/currency.js';

// Export shared currency formatter factory
export { getCurrencyFormatter } from './src/currency-format.js';

// Export all types from types.ts
export type {
  // Enum Types
  TransactionRecurrence,
  TransactionKind,
  PriorityLevel,
  SavingsGoalStatus,

  // Budget types
  Budget,
  BudgetCreate,
  BudgetUpdate,
  BudgetGenerate,
  BudgetGenerateResponse,

  // Transaction types
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  SearchItemType,
  TransactionSearchQuery,
  TransactionSearchResult,
  TransactionSearchResponse,

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
  BudgetSummary,
  BudgetDetailsResponse,
  BudgetWithDetails,
  BudgetExportResponse,
  BudgetField,
  ListBudgetsQuery,
  BudgetSparse,
  BudgetSparseListResponse,
  TransactionCreateResponse,
  TransactionUpdateResponse,
  TransactionFindOneResponse,
  TransactionListResponse,
  TransactionDeleteResponse,
  TransactionPostponeResponse,
  BudgetTemplateResponse,
  BudgetTemplateListResponse,
  BudgetTemplateDeleteResponse,
  BudgetTemplateCreateResponse,
  BudgetTemplateCreateTransactionalResponse,
  TemplateUsageResponse,
  TemplateLineResponse,
  TemplateLineListResponse,
  TemplateLineDeleteResponse,
  TemplateLineUpdateWithId,
  TemplateLinesBulkOperations,
  TemplateLinesBulkOperationsResponse,
  TemplateLinesPropagationSummary,
  TransactionResponse,

  // Savings Goal types
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalUpdate,
  SavingsGoalResponse,
  SavingsGoalListResponse,
  SavingsGoalDeleteResponse,
  SavingsGoalPaceStatus,
  SavingsGoalProgress,
  SavingsGoalProgressResponse,
  SavingsGoalContribution,
  SavingsGoalContributionsResponse,
  SavingsGoalPlanMonth,
  SavingsGoalPlanApply,
  SavingsGoalPlanApplyResponse,

  // Tag types (PUL-18)
  Tag,
  TagCreate,
  TagUpdate,
  TagResponse,
  TagListResponse,
  TagHistoryMonths,
  TagHistoryQuery,
  TagHistoryMonth,
  TagHistory,
  TagHistoryResponse,
  TagDeleteResponse,

  // Budget Line types
  BudgetLine,
  BudgetLineCreate,
  BudgetLineUpdate,
  BudgetLineResponse,
  BudgetLineListResponse,
  BudgetLineDeleteResponse,
  BudgetLinePostponeResponse,

  // Budget Line Spread types (PUL-17)
  BudgetLineSpreadCreate,
  BudgetLineSpreadResponse,
  SpreadFromExistingPeriod,
  BudgetLineSpreadFromLineCreate,
  TransactionSpreadFromTxnCreate,
  SpreadOccurrence,
  SpreadOccurrencesResponse,

  // Currency types
  SupportedCurrency,
  CurrencyRateQuery,
  CurrencyRateResponse,

  // User types
  UserProfile,
  UpdateProfile,
  UserProfileResponse,
  PublicInfoResponse,
  DeleteAccountResponse,
  PayDayOfMonth,
  UpdateUserSettings,
  UserSettings,
  UserSettingsResponse,

  // Auth types
  UserInfo,
  AuthLogin,
  AuthLoginResponse,
  AuthValidationResponse,
  AuthErrorResponse,

  // Demo mode types
  DemoSessionCreate,
  DemoSessionResponse,

  // Encryption types — requests
  EncryptionValidateKeyRequest,
  EncryptionRecoverRequest,
  EncryptionVerifyRecoveryKeyRequest,
  EncryptionChangePinRequest,
  // Encryption types — responses
  EncryptionVaultStatusResponse,
  EncryptionSaltResponse,
  EncryptionSetupRecoveryResponse,
  EncryptionRecoverResponse,
  EncryptionChangePinResponse,

  // App version
  AppVersionResponse,

  // What's new
  WhatsNewEntry,
  WhatsNewResponse,
  WhatsNewQuery,
} from './schemas.js';
