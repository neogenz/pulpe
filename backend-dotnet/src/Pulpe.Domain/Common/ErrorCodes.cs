namespace Pulpe.Domain.Common;

public static class ErrorCodes
{
    // Generic
    public const string InternalServer = "ERR_INTERNAL_SERVER";
    public const string RequiredDataMissing = "ERR_REQUIRED_DATA_MISSING";
    public const string InvalidIdFormat = "ERR_INVALID_ID_FORMAT";
    public const string Unknown = "ERR_UNKNOWN";

    // Auth
    public const string AuthTokenMissing = "ERR_AUTH_TOKEN_MISSING";
    public const string AuthTokenInvalid = "ERR_AUTH_TOKEN_INVALID";
    public const string AuthUnauthorized = "ERR_AUTH_UNAUTHORIZED";
    public const string AuthSessionExpired = "ERR_AUTH_SESSION_EXPIRED";
    public const string AuthClientKeyMissing = "ERR_AUTH_CLIENT_KEY_MISSING";
    public const string AuthClientKeyInvalid = "ERR_AUTH_CLIENT_KEY_INVALID";
    public const string UserAccountBlocked = "ERR_USER_ACCOUNT_BLOCKED";

    // Budget
    public const string BudgetNotFound = "ERR_BUDGET_NOT_FOUND";
    public const string BudgetCreateFailed = "ERR_BUDGET_CREATE_FAILED";
    public const string BudgetUpdateFailed = "ERR_BUDGET_UPDATE_FAILED";
    public const string BudgetDeleteFailed = "ERR_BUDGET_DELETE_FAILED";
    public const string BudgetFetchFailed = "ERR_BUDGET_FETCH_FAILED";
    public const string BudgetUnknownSparseFields = "ERR_BUDGET_UNKNOWN_SPARSE_FIELDS";
    public const string BudgetAlreadyExists = "ERR_BUDGET_ALREADY_EXISTS_FOR_MONTH";
    public const string BudgetInvalidMonth = "ERR_BUDGET_INVALID_MONTH";

    // Budget Line
    public const string BudgetLineNotFound = "ERR_BUDGET_LINE_NOT_FOUND";
    public const string BudgetLineCreateFailed = "ERR_BUDGET_LINE_CREATE_FAILED";
    public const string BudgetLineUpdateFailed = "ERR_BUDGET_LINE_UPDATE_FAILED";
    public const string BudgetLineDeleteFailed = "ERR_BUDGET_LINE_DELETE_FAILED";
    public const string BudgetLineFetchFailed = "ERR_BUDGET_LINE_FETCH_FAILED";

    // Transaction
    public const string TransactionNotFound = "ERR_TRANSACTION_NOT_FOUND";
    public const string TransactionCreateFailed = "ERR_TRANSACTION_CREATE_FAILED";
    public const string TransactionUpdateFailed = "ERR_TRANSACTION_UPDATE_FAILED";
    public const string TransactionDeleteFailed = "ERR_TRANSACTION_DELETE_FAILED";
    public const string TransactionFetchFailed = "ERR_TRANSACTION_FETCH_FAILED";
    public const string TransactionKindMismatch = "ERR_TRANSACTION_KIND_MISMATCH";
    public const string TransactionBudgetMismatch = "ERR_TRANSACTION_BUDGET_MISMATCH";
    public const string TransactionSearchFailed = "ERR_TRANSACTION_SEARCH_FAILED";

    // Template
    public const string TemplateNotFound = "ERR_TEMPLATE_NOT_FOUND";
    public const string TemplateCreateFailed = "ERR_TEMPLATE_CREATE_FAILED";
    public const string TemplateUpdateFailed = "ERR_TEMPLATE_UPDATE_FAILED";
    public const string TemplateDeleteFailed = "ERR_TEMPLATE_DELETE_FAILED";
    public const string TemplateFetchFailed = "ERR_TEMPLATE_FETCH_FAILED";
    public const string TemplateAccessDenied = "ERR_TEMPLATE_ACCESS_DENIED";
    public const string TemplateLimitReached = "ERR_TEMPLATE_LIMIT_REACHED";
    public const string TemplateInUse = "ERR_TEMPLATE_IN_USE";
    public const string TemplateLineNotFound = "ERR_TEMPLATE_LINE_NOT_FOUND";
    public const string TemplateLineCreateFailed = "ERR_TEMPLATE_LINE_CREATE_FAILED";
    public const string TemplateLineUpdateFailed = "ERR_TEMPLATE_LINE_UPDATE_FAILED";
    public const string TemplateLineDeleteFailed = "ERR_TEMPLATE_LINE_DELETE_FAILED";
    public const string TemplateBulkUpdateFailed = "ERR_TEMPLATE_BULK_UPDATE_FAILED";
    public const string TemplateBulkOperationsFailed = "ERR_TEMPLATE_BULK_OPERATIONS_FAILED";
    public const string TemplatePropagationFailed = "ERR_TEMPLATE_PROPAGATION_FAILED";
    public const string TemplateOnboardingRateLimit = "ERR_TEMPLATE_ONBOARDING_RATE_LIMIT";

    // Encryption
    public const string EncryptionFailed = "ERR_ENCRYPTION_FAILED";
    public const string DecryptionFailed = "ERR_DECRYPTION_FAILED";
    public const string EncryptionKeyNotFound = "ERR_ENCRYPTION_KEY_NOT_FOUND";
    public const string EncryptionInvalidKey = "ERR_ENCRYPTION_INVALID_KEY";
    public const string EncryptionRecoveryFailed = "ERR_ENCRYPTION_RECOVERY_FAILED";
    public const string EncryptionRecoveryAlreadySetup = "ERR_ENCRYPTION_RECOVERY_ALREADY_SETUP";
    public const string EncryptionRekeyFailed = "ERR_ENCRYPTION_REKEY_FAILED";
    public const string EncryptionSameKey = "ERR_ENCRYPTION_SAME_KEY";

    // User
    public const string UserNotFound = "ERR_USER_NOT_FOUND";
    public const string UserUpdateFailed = "ERR_USER_UPDATE_FAILED";
    public const string UserSettingsInvalid = "ERR_USER_SETTINGS_INVALID";
    public const string UserOnboardingFailed = "ERR_USER_ONBOARDING_FAILED";
    public const string UserDeleteFailed = "ERR_USER_DELETE_FAILED";

    // Infrastructure
    public const string DatabaseError = "ERR_DATABASE_ERROR";
    public const string DatabaseConnectionFailed = "ERR_DATABASE_CONNECTION_FAILED";
    public const string ValidationFailed = "ERR_VALIDATION_FAILED";
    public const string RateLimitExceeded = "ERR_RATE_LIMIT_EXCEEDED";

    // Currency
    public const string CurrencyRateFetchFailed = "ERR_CURRENCY_RATE_FETCH_FAILED";
    public const string CurrencyUnsupportedCurrency = "ERR_CURRENCY_UNSUPPORTED";
    public const string CurrencyInvalidFxMetadata = "ERR_CURRENCY_INVALID_FX_METADATA";

    // Demo
    public const string DemoSessionFailed = "ERR_DEMO_SESSION_FAILED";
    public const string DemoCleanupFailed = "ERR_DEMO_CLEANUP_FAILED";
}
