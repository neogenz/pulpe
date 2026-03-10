import { HttpStatus } from '@nestjs/common';
import { API_ERROR_CODES, type ApiErrorCode } from 'pulpe-shared';

/**
 * Centralized error definitions with codes, messages, and HTTP status
 */
export interface ErrorDefinition {
  code: ApiErrorCode;
  message: (details?: Record<string, unknown>) => string;
  httpStatus: HttpStatus;
}

export const ERROR_DEFINITIONS = {
  // Generic Errors
  INTERNAL_SERVER_ERROR: {
    code: API_ERROR_CODES.INTERNAL_SERVER,
    message: () => 'Internal server error',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  REQUIRED_DATA_MISSING: {
    code: API_ERROR_CODES.REQUIRED_DATA_MISSING,
    message: (details?: Record<string, unknown>) =>
      details?.fields
        ? `Required data missing: ${(details.fields as string[]).join(', ')}`
        : 'Required data missing',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  INVALID_ID_FORMAT: {
    code: API_ERROR_CODES.INVALID_ID_FORMAT,
    message: (details?: Record<string, unknown>) =>
      details?.id ? `Invalid ID format: '${details.id}'` : 'Invalid ID format',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  UNKNOWN_EXCEPTION: {
    code: API_ERROR_CODES.UNKNOWN,
    message: () => 'An unknown error occurred',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Auth Errors
  AUTH_TOKEN_MISSING: {
    code: API_ERROR_CODES.AUTH_TOKEN_MISSING,
    message: () => 'Authentication token missing',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_TOKEN_INVALID: {
    code: API_ERROR_CODES.AUTH_TOKEN_INVALID,
    message: () => 'Invalid authentication token',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_UNAUTHORIZED: {
    code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
    message: () => 'Unauthorized',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_SESSION_EXPIRED: {
    code: API_ERROR_CODES.AUTH_SESSION_EXPIRED,
    message: () => 'Session expired',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_USER_FETCH_FAILED: {
    code: API_ERROR_CODES.AUTH_USER_FETCH_FAILED,
    message: () => 'Failed to fetch user information',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  AUTH_CLIENT_KEY_MISSING: {
    code: API_ERROR_CODES.AUTH_CLIENT_KEY_MISSING,
    message: () => 'Client encryption key missing',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  AUTH_CLIENT_KEY_INVALID: {
    code: API_ERROR_CODES.AUTH_CLIENT_KEY_INVALID,
    message: () => 'Client encryption key is invalid',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  RECOVERY_KEY_NOT_CONFIGURED: {
    code: API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED,
    message: () => 'No recovery key configured for this account',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  RECOVERY_KEY_INVALID: {
    code: API_ERROR_CODES.RECOVERY_KEY_INVALID,
    message: () => 'Invalid recovery key',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  RECOVERY_KEY_ALREADY_EXISTS: {
    code: API_ERROR_CODES.RECOVERY_KEY_ALREADY_EXISTS,
    message: () => 'A recovery key already exists for this account',
    httpStatus: HttpStatus.CONFLICT,
  },
  ENCRYPTION_KEY_CHECK_FAILED: {
    code: API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
    message: () => 'Client key verification failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  ENCRYPTION_SAME_KEY: {
    code: API_ERROR_CODES.ENCRYPTION_SAME_KEY,
    message: () => 'New client key must be different from the old one',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  ENCRYPTION_REKEY_PARTIAL_FAILURE: {
    code: API_ERROR_CODES.ENCRYPTION_REKEY_PARTIAL_FAILURE,
    message: () => 'Re-encryption succeeded but recovery key wrapping failed.',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  ENCRYPTION_REKEY_FAILED: {
    code: API_ERROR_CODES.ENCRYPTION_REKEY_FAILED,
    message: () =>
      'Re-encryption failed. Data remains encrypted with the previous key.',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Budget Errors
  BUDGET_NOT_FOUND: {
    code: API_ERROR_CODES.BUDGET_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Budget with ID '${details.id}' not found`
        : 'Budget not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  BUDGET_CREATE_FAILED: {
    code: API_ERROR_CODES.BUDGET_CREATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.reason
        ? `Failed to create budget: ${details.reason}`
        : 'Failed to create budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_UPDATE_FAILED: {
    code: API_ERROR_CODES.BUDGET_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update budget with ID '${details.id}'`
        : 'Failed to update budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_DELETE_FAILED: {
    code: API_ERROR_CODES.BUDGET_DELETE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to delete budget with ID '${details.id}'`
        : 'Failed to delete budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_FETCH_FAILED: {
    code: API_ERROR_CODES.BUDGET_FETCH_FAILED,
    message: () => 'Failed to fetch budgets',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_ALREADY_EXISTS_FOR_MONTH: {
    code: API_ERROR_CODES.BUDGET_ALREADY_EXISTS,
    message: (details?: Record<string, unknown>) =>
      details?.month && details?.year
        ? `A budget already exists for month ${details.month}/${details.year}`
        : 'A budget already exists for this month',
    httpStatus: HttpStatus.CONFLICT,
  },
  BUDGET_GENERATE_FAILED: {
    code: API_ERROR_CODES.BUDGET_GENERATE_FAILED,
    message: () => 'Failed to generate budgets',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_INVALID_MONTH_FORMAT: {
    code: API_ERROR_CODES.BUDGET_INVALID_MONTH,
    message: (details?: Record<string, unknown>) =>
      details?.value
        ? `Invalid month format '${details.value}'. Use YYYY-MM format`
        : 'Invalid month format. Use YYYY-MM format',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Template Errors
  TEMPLATE_NOT_FOUND: {
    code: API_ERROR_CODES.TEMPLATE_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Template with ID '${details.id}' not found`
        : 'Template not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_CREATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_CREATE_FAILED,
    message: () => 'Failed to create template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_UPDATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update template with ID '${details.id}'`
        : 'Failed to update template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_DELETE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_DELETE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to delete template with ID '${details.id}'`
        : 'Failed to delete template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_FETCH_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_FETCH_FAILED,
    message: () => 'Failed to fetch templates',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_CREATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINES_CREATE_FAILED,
    message: () => 'Failed to create template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_FETCH_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINES_FETCH_FAILED,
    message: () => 'Failed to fetch template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINE_NOT_FOUND: {
    code: API_ERROR_CODES.TEMPLATE_LINE_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Template line with ID '${details.id}' not found`
        : 'Template line not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_LINE_UPDATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINE_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update template line with ID '${details.id}'`
        : 'Failed to update template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINE_DELETE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINE_DELETE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to delete template line with ID '${details.id}'`
        : 'Failed to delete template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_ONBOARDING_RATE_LIMIT: {
    code: API_ERROR_CODES.TEMPLATE_ONBOARDING_RATE_LIMIT,
    message: () =>
      'You can only create one template from onboarding per 24 hours',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  TEMPLATE_ACCESS_FORBIDDEN: {
    code: API_ERROR_CODES.TEMPLATE_ACCESS_FORBIDDEN,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Access forbidden to template with ID '${details.id}'`
        : 'Access forbidden to template',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  TEMPLATE_LINE_ACCESS_FORBIDDEN: {
    code: API_ERROR_CODES.TEMPLATE_LINE_ACCESS_FORBIDDEN,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Access forbidden to template line with ID '${details.id}'`
        : 'Access forbidden to template line',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  TEMPLATE_LINE_CREATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINE_CREATE_FAILED,
    message: () => 'Failed to create template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINE_FETCH_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINE_FETCH_FAILED,
    message: () => 'Failed to fetch template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LIMIT_EXCEEDED: {
    code: API_ERROR_CODES.TEMPLATE_LIMIT_EXCEEDED,
    message: (details?: Record<string, unknown>) =>
      details?.limit
        ? `Template limit of ${details.limit} exceeded`
        : 'Template limit exceeded',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TEMPLATE_IN_USE: {
    code: API_ERROR_CODES.TEMPLATE_IN_USE,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Template with ID '${details.id}' is in use and cannot be deleted`
        : 'Template is in use and cannot be deleted',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TEMPLATE_LINES_BULK_UPDATE_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINES_BULK_UPDATE_FAILED,
    message: () => 'Failed to bulk update template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_BULK_OPERATIONS_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINES_BULK_OPERATIONS_FAILED,
    message: () => 'Failed to perform bulk operations on template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_VALIDATION_FAILED: {
    code: API_ERROR_CODES.TEMPLATE_LINES_VALIDATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.reason
        ? `Template lines validation failed: ${details.reason}`
        : 'Template lines validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TEMPLATE_LINE_TEMPLATE_MISMATCH: {
    code: API_ERROR_CODES.TEMPLATE_LINE_TEMPLATE_MISMATCH,
    message: (details?: Record<string, unknown>) =>
      details?.lineId && details?.templateId
        ? `Template line '${details.lineId}' does not belong to template '${details.templateId}'`
        : 'Template line does not belong to the specified template',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Transaction Errors
  TRANSACTION_NOT_FOUND: {
    code: API_ERROR_CODES.TRANSACTION_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Transaction with ID '${details.id}' not found`
        : 'Transaction not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TRANSACTION_CREATE_FAILED: {
    code: API_ERROR_CODES.TRANSACTION_CREATE_FAILED,
    message: () => 'Failed to create transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_UPDATE_FAILED: {
    code: API_ERROR_CODES.TRANSACTION_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update transaction with ID '${details.id}'`
        : 'Failed to update transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_DELETE_FAILED: {
    code: API_ERROR_CODES.TRANSACTION_DELETE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to delete transaction with ID '${details.id}'`
        : 'Failed to delete transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_FETCH_FAILED: {
    code: API_ERROR_CODES.TRANSACTION_FETCH_FAILED,
    message: () => 'Failed to fetch transactions',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_BUDGET_MISMATCH: {
    code: API_ERROR_CODES.TRANSACTION_BUDGET_MISMATCH,
    message: (details?: Record<string, unknown>) =>
      details?.transactionBudgetId && details?.providedBudgetId
        ? `Transaction budget ID '${details.transactionBudgetId}' does not match provided budget ID '${details.providedBudgetId}'`
        : 'Transaction budget does not match the provided budget ID',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TRANSACTION_BUDGET_LINE_MISMATCH: {
    code: API_ERROR_CODES.TRANSACTION_BUDGET_LINE_MISMATCH,
    message: (details?: Record<string, unknown>) =>
      details?.budgetLineId && details?.budgetId
        ? `Budget line '${details.budgetLineId}' does not belong to budget '${details.budgetId}'`
        : 'Budget line does not belong to the specified budget',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TRANSACTION_VALIDATION_FAILED: {
    code: API_ERROR_CODES.TRANSACTION_VALIDATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.reason
        ? `Transaction validation failed: ${details.reason}`
        : 'Transaction validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Budget Line Errors
  BUDGET_LINE_NOT_FOUND: {
    code: API_ERROR_CODES.BUDGET_LINE_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Budget line with ID '${details.id}' not found`
        : 'Budget line not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  BUDGET_LINE_CREATE_FAILED: {
    code: API_ERROR_CODES.BUDGET_LINE_CREATE_FAILED,
    message: () => 'Failed to create budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_UPDATE_FAILED: {
    code: API_ERROR_CODES.BUDGET_LINE_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update budget line with ID '${details.id}'`
        : 'Failed to update budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_DELETE_FAILED: {
    code: API_ERROR_CODES.BUDGET_LINE_DELETE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to delete budget line with ID '${details.id}'`
        : 'Failed to delete budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_FETCH_FAILED: {
    code: API_ERROR_CODES.BUDGET_LINE_FETCH_FAILED,
    message: () => 'Failed to fetch budget lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_BUDGET_MISMATCH: {
    code: API_ERROR_CODES.BUDGET_LINE_BUDGET_MISMATCH,
    message: (details?: Record<string, unknown>) =>
      details?.budgetLineId && details?.budgetId
        ? `Budget line '${details.budgetLineId}' does not belong to budget '${details.budgetId}'`
        : 'Budget line does not belong to the specified budget',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  BUDGET_LINE_WITH_TRANSACTIONS: {
    code: API_ERROR_CODES.BUDGET_LINE_WITH_TRANSACTIONS,
    message: (details?: Record<string, unknown>) =>
      details?.transactionCount
        ? `Cannot delete budget line with ${details.transactionCount} associated transaction(s)`
        : 'Cannot delete budget line with associated transactions',
    httpStatus: HttpStatus.CONFLICT,
  },
  BUDGET_LINE_VALIDATION_FAILED: {
    code: API_ERROR_CODES.BUDGET_LINE_VALIDATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.reason
        ? `Budget line validation failed: ${details.reason}`
        : 'Budget line validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // User Errors
  USER_NOT_FOUND: {
    code: API_ERROR_CODES.USER_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.id ? `User with ID '${details.id}' not found` : 'User not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  USER_UPDATE_FAILED: {
    code: API_ERROR_CODES.USER_UPDATE_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.id
        ? `Failed to update user with ID '${details.id}'`
        : 'Failed to update user',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_FETCH_FAILED: {
    code: API_ERROR_CODES.USER_FETCH_FAILED,
    message: () => 'Failed to fetch user',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_PROFILE_UPDATE_FAILED: {
    code: API_ERROR_CODES.USER_PROFILE_UPDATE_FAILED,
    message: () => 'Failed to update user profile',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_ONBOARDING_UPDATE_FAILED: {
    code: API_ERROR_CODES.USER_ONBOARDING_UPDATE_FAILED,
    message: () => 'Failed to update onboarding status',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_ONBOARDING_FETCH_FAILED: {
    code: API_ERROR_CODES.USER_ONBOARDING_FETCH_FAILED,
    message: () => 'Failed to fetch onboarding status',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_SETTINGS_UPDATE_FAILED: {
    code: API_ERROR_CODES.USER_SETTINGS_UPDATE_FAILED,
    message: () => 'Failed to update user settings',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_SETTINGS_FETCH_FAILED: {
    code: API_ERROR_CODES.USER_SETTINGS_FETCH_FAILED,
    message: () => 'Failed to fetch user settings',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_ACCOUNT_DELETION_FAILED: {
    code: API_ERROR_CODES.USER_ACCOUNT_DELETION_FAILED,
    message: () => 'Failed to schedule account deletion',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_ACCOUNT_BLOCKED: {
    code: API_ERROR_CODES.USER_ACCOUNT_BLOCKED,
    message: () => 'Account is scheduled for deletion',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // Validation Errors
  VALIDATION_FAILED: {
    code: API_ERROR_CODES.VALIDATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.reason
        ? `Validation failed: ${details.reason}`
        : 'Validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  VALIDATION_ZOD_FAILED: {
    code: API_ERROR_CODES.ZOD_VALIDATION_FAILED,
    message: () => 'Request validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Database Errors
  DATABASE_CONNECTION_FAILED: {
    code: API_ERROR_CODES.DATABASE_CONNECTION_FAILED,
    message: () => 'Database connection failed',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  DATABASE_QUERY_FAILED: {
    code: API_ERROR_CODES.DATABASE_QUERY_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.operation
        ? `Database query failed during ${details.operation}`
        : 'Database query failed',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  DATABASE_TRANSACTION_FAILED: {
    code: API_ERROR_CODES.DATABASE_TRANSACTION_FAILED,
    message: () => 'Database transaction failed',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Data Integrity Errors
  DATA_INTEGRITY_VIOLATION: {
    code: API_ERROR_CODES.DATA_INTEGRITY_VIOLATION,
    message: (details?: Record<string, unknown>) =>
      details?.constraint
        ? `Data integrity violation: ${details.constraint}`
        : 'Data integrity violation',
    httpStatus: HttpStatus.CONFLICT,
  },

  // Resource State Errors
  RESOURCE_STATE_INVALID: {
    code: API_ERROR_CODES.RESOURCE_STATE_INVALID,
    message: (details?: Record<string, unknown>) =>
      details?.currentState && details?.expectedState
        ? `Resource is in state '${details.currentState}' but operation requires '${details.expectedState}'`
        : 'Resource is in invalid state for this operation',
    httpStatus: HttpStatus.CONFLICT,
  },

  // Business Rule Violations
  BUSINESS_RULE_VIOLATION: {
    code: API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
    message: (details?: Record<string, unknown>) =>
      details?.rule
        ? `Business rule violation: ${details.rule}`
        : 'Operation violates business rules',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Concurrent Access Errors
  CONCURRENT_MODIFICATION: {
    code: API_ERROR_CODES.CONCURRENT_MODIFICATION,
    message: (details?: Record<string, unknown>) =>
      details?.resource
        ? `Resource '${details.resource}' was modified by another operation`
        : 'Resource was modified concurrently',
    httpStatus: HttpStatus.CONFLICT,
  },

  // Missing Dependency Errors
  DEPENDENCY_NOT_FOUND: {
    code: API_ERROR_CODES.DEPENDENCY_NOT_FOUND,
    message: (details?: Record<string, unknown>) =>
      details?.dependency && details?.dependencyId
        ? `Required dependency '${details.dependency}' with ID '${details.dependencyId}' not found`
        : 'Required dependency not found',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Rate Limiting (General)
  RATE_LIMIT_EXCEEDED: {
    code: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message: (details?: Record<string, unknown>) =>
      details?.operation && details?.limit
        ? `Rate limit exceeded for ${details.operation}: ${details.limit}`
        : 'Rate limit exceeded',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },

  // Import/Export Errors
  IMPORT_VALIDATION_FAILED: {
    code: API_ERROR_CODES.IMPORT_VALIDATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.errors
        ? `Import validation failed: ${details.errors}`
        : 'Import data validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  EXPORT_GENERATION_FAILED: {
    code: API_ERROR_CODES.EXPORT_GENERATION_FAILED,
    message: (details?: Record<string, unknown>) =>
      details?.format
        ? `Failed to generate export in ${details.format} format`
        : 'Export generation failed',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Currency Errors
  CURRENCY_RATE_FETCH_FAILED: {
    code: 'ERR_CURRENCY_RATE_FETCH_FAILED',
    message: (details?: Record<string, unknown>) =>
      details?.base && details?.target
        ? `Failed to fetch exchange rate for ${details.base}/${details.target}`
        : 'Failed to fetch currency exchange rate',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },

  // Configuration Errors
  CONFIGURATION_INVALID: {
    code: API_ERROR_CODES.CONFIGURATION_INVALID,
    message: (details?: Record<string, unknown>) =>
      details?.setting
        ? `Invalid configuration for ${details.setting}`
        : 'Invalid configuration detected',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // External Service Errors
  EXTERNAL_SERVICE_UNAVAILABLE: {
    code: API_ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE,
    message: (details?: Record<string, unknown>) =>
      details?.service
        ? `External service '${details.service}' is unavailable`
        : 'External service unavailable',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
} as const satisfies Record<string, ErrorDefinition>;

// Type for error definition keys
export type ErrorDefinitionKey = keyof typeof ERROR_DEFINITIONS;
