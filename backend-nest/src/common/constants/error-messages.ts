export const ERROR_MESSAGES = {
  // Generic errors
  INTERNAL_SERVER_ERROR: 'Internal server error',
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Bad request',

  // Authentication errors
  AUTH_TOKEN_INVALID: 'Invalid authentication token',
  AUTH_TOKEN_EXPIRED: 'Authentication token expired',
  AUTH_CREDENTIALS_INVALID: 'Invalid credentials',

  // Budget errors
  BUDGET_NOT_FOUND: 'Budget not found',
  BUDGET_CREATE_FAILED: 'Failed to create budget',
  BUDGET_UPDATE_FAILED: 'Failed to update budget',
  BUDGET_DELETE_FAILED: 'Failed to delete budget',
  BUDGET_LIST_FAILED: 'Failed to retrieve budgets',
  BUDGET_ACCESS_DENIED: 'You do not have access to this budget',
  BUDGET_ALREADY_EXISTS: 'A budget already exists for this month',

  // Budget Template errors
  TEMPLATE_NOT_FOUND: 'Template not found',
  TEMPLATE_CREATE_FAILED: 'Failed to create template',
  TEMPLATE_UPDATE_FAILED: 'Failed to update template',
  TEMPLATE_DELETE_FAILED: 'Failed to delete template',
  TEMPLATE_LIST_FAILED: 'Failed to retrieve templates',
  TEMPLATE_ACCESS_DENIED: 'You do not have access to this template',
  TEMPLATE_LINE_NOT_FOUND: 'Template line not found',
  TEMPLATE_LINE_CREATE_FAILED: 'Failed to create template line',
  TEMPLATE_LINE_UPDATE_FAILED: 'Failed to update template line',
  TEMPLATE_LINE_DELETE_FAILED: 'Failed to delete template line',
  TEMPLATE_LINE_ACCESS_DENIED: 'You do not have access to this template line',
  TEMPLATE_LINES_LIST_FAILED: 'Failed to retrieve template lines',
  TEMPLATE_LINES_BULK_UPDATE_FAILED: 'Failed to bulk update template lines',
  TEMPLATE_ONBOARDING_RATE_LIMIT:
    'You can only create one template from onboarding per 24 hours',

  // Transaction errors
  TRANSACTION_NOT_FOUND: 'Transaction not found',
  TRANSACTION_CREATE_FAILED: 'Failed to create transaction',
  TRANSACTION_UPDATE_FAILED: 'Failed to update transaction',
  TRANSACTION_DELETE_FAILED: 'Failed to delete transaction',
  TRANSACTION_LIST_FAILED: 'Failed to retrieve transactions',
  TRANSACTION_ACCESS_DENIED: 'You do not have access to this transaction',
  TRANSACTION_BUDGET_REQUIRED: 'Budget ID is required',
  TRANSACTION_MISSING_FIELD: 'Missing required field',

  // Budget Line errors
  BUDGET_LINE_NOT_FOUND: 'Budget line not found',
  BUDGET_LINE_CREATE_FAILED: 'Failed to create budget line',
  BUDGET_LINE_UPDATE_FAILED: 'Failed to update budget line',
  BUDGET_LINE_DELETE_FAILED: 'Failed to delete budget line',
  BUDGET_LINE_LIST_FAILED: 'Failed to retrieve budget lines',
  BUDGET_LINE_ACCESS_DENIED: 'You do not have access to this budget line',
  BUDGET_LINE_BUDGET_REQUIRED:
    'Budget ID is required - must be provided either in the DTO or as parameter',

  // Validation errors
  VALIDATION_BUDGET_ID_REQUIRED: 'Budget ID is required',
  VALIDATION_NAME_REQUIRED: 'Name is required',
  VALIDATION_AMOUNT_REQUIRED: 'Amount is required',
  VALIDATION_INVALID_DATE: 'Invalid date format',
  VALIDATION_INVALID_AMOUNT: 'Invalid amount',
  VALIDATION_INVALID_ENUM: 'Invalid enum value',
  VALIDATION_NAME_TOO_LONG: 'Name cannot exceed 100 characters',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',

  // Database errors
  DATABASE_CONNECTION_ERROR: 'Database connection error',
  DATABASE_QUERY_ERROR: 'Database query error',
  DATABASE_TRANSACTION_ERROR: 'Database transaction error',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
