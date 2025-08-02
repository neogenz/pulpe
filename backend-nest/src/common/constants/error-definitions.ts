import { HttpStatus } from '@nestjs/common';

/**
 * Centralized error definitions with codes, messages, and HTTP status
 */
export interface ErrorDefinition {
  code: string;
  message: string;
  httpStatus: HttpStatus;
}

export const ERROR_DEFINITIONS = {
  // Generic Errors
  INTERNAL_SERVER_ERROR: {
    code: 'ERR_INTERNAL_SERVER',
    message: 'Internal server error',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  REQUIRED_DATA_MISSING: {
    code: 'ERR_REQUIRED_DATA_MISSING',
    message: 'Required data missing',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  INVALID_ID_FORMAT: {
    code: 'ERR_INVALID_ID_FORMAT',
    message: 'Invalid ID format',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  UNKNOWN_EXCEPTION: {
    code: 'ERR_UNKNOWN',
    message: 'An unknown error occurred',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Auth Errors
  AUTH_TOKEN_MISSING: {
    code: 'ERR_AUTH_TOKEN_MISSING',
    message: 'Authentication token missing',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_TOKEN_INVALID: {
    code: 'ERR_AUTH_TOKEN_INVALID',
    message: 'Invalid authentication token',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_UNAUTHORIZED: {
    code: 'ERR_AUTH_UNAUTHORIZED',
    message: 'Unauthorized',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_SESSION_EXPIRED: {
    code: 'ERR_AUTH_SESSION_EXPIRED',
    message: 'Session expired',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_USER_FETCH_FAILED: {
    code: 'ERR_AUTH_USER_FETCH_FAILED',
    message: 'Failed to fetch user information',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Budget Errors
  BUDGET_NOT_FOUND: {
    code: 'ERR_BUDGET_NOT_FOUND',
    message: 'Budget not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  BUDGET_CREATE_FAILED: {
    code: 'ERR_BUDGET_CREATE_FAILED',
    message: 'Failed to create budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_UPDATE_FAILED: {
    code: 'ERR_BUDGET_UPDATE_FAILED',
    message: 'Failed to update budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_DELETE_FAILED: {
    code: 'ERR_BUDGET_DELETE_FAILED',
    message: 'Failed to delete budget',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_FETCH_FAILED: {
    code: 'ERR_BUDGET_FETCH_FAILED',
    message: 'Failed to fetch budgets',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_ALREADY_EXISTS_FOR_MONTH: {
    code: 'ERR_BUDGET_ALREADY_EXISTS',
    message: 'A budget already exists for this month',
    httpStatus: HttpStatus.CONFLICT,
  },
  BUDGET_INVALID_MONTH_FORMAT: {
    code: 'ERR_BUDGET_INVALID_MONTH',
    message: 'Invalid month format. Use YYYY-MM format',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Template Errors
  TEMPLATE_NOT_FOUND: {
    code: 'ERR_TEMPLATE_NOT_FOUND',
    message: 'Template not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_CREATE_FAILED: {
    code: 'ERR_TEMPLATE_CREATE_FAILED',
    message: 'Failed to create template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_UPDATE_FAILED: {
    code: 'ERR_TEMPLATE_UPDATE_FAILED',
    message: 'Failed to update template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_DELETE_FAILED: {
    code: 'ERR_TEMPLATE_DELETE_FAILED',
    message: 'Failed to delete template',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_FETCH_FAILED: {
    code: 'ERR_TEMPLATE_FETCH_FAILED',
    message: 'Failed to fetch templates',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_CREATE_FAILED: {
    code: 'ERR_TEMPLATE_LINES_CREATE_FAILED',
    message: 'Failed to create template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_FETCH_FAILED: {
    code: 'ERR_TEMPLATE_LINES_FETCH_FAILED',
    message: 'Failed to fetch template lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINE_NOT_FOUND: {
    code: 'ERR_TEMPLATE_LINE_NOT_FOUND',
    message: 'Template line not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_LINE_UPDATE_FAILED: {
    code: 'ERR_TEMPLATE_LINE_UPDATE_FAILED',
    message: 'Failed to update template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINE_DELETE_FAILED: {
    code: 'ERR_TEMPLATE_LINE_DELETE_FAILED',
    message: 'Failed to delete template line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_ONBOARDING_RATE_LIMIT: {
    code: 'ERR_TEMPLATE_ONBOARDING_RATE_LIMIT',
    message: 'You can only create one template from onboarding per 24 hours',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },

  // Transaction Errors
  TRANSACTION_NOT_FOUND: {
    code: 'ERR_TRANSACTION_NOT_FOUND',
    message: 'Transaction not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  TRANSACTION_CREATE_FAILED: {
    code: 'ERR_TRANSACTION_CREATE_FAILED',
    message: 'Failed to create transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_UPDATE_FAILED: {
    code: 'ERR_TRANSACTION_UPDATE_FAILED',
    message: 'Failed to update transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_DELETE_FAILED: {
    code: 'ERR_TRANSACTION_DELETE_FAILED',
    message: 'Failed to delete transaction',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_FETCH_FAILED: {
    code: 'ERR_TRANSACTION_FETCH_FAILED',
    message: 'Failed to fetch transactions',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TRANSACTION_BUDGET_MISMATCH: {
    code: 'ERR_TRANSACTION_BUDGET_MISMATCH',
    message: 'Transaction budget does not match the provided budget ID',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TRANSACTION_BUDGET_LINE_MISMATCH: {
    code: 'ERR_TRANSACTION_BUDGET_LINE_MISMATCH',
    message: 'Budget line does not belong to the specified budget',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  TRANSACTION_VALIDATION_FAILED: {
    code: 'ERR_TRANSACTION_VALIDATION_FAILED',
    message: 'Transaction validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Budget Line Errors
  BUDGET_LINE_NOT_FOUND: {
    code: 'ERR_BUDGET_LINE_NOT_FOUND',
    message: 'Budget line not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  BUDGET_LINE_CREATE_FAILED: {
    code: 'ERR_BUDGET_LINE_CREATE_FAILED',
    message: 'Failed to create budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_UPDATE_FAILED: {
    code: 'ERR_BUDGET_LINE_UPDATE_FAILED',
    message: 'Failed to update budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_DELETE_FAILED: {
    code: 'ERR_BUDGET_LINE_DELETE_FAILED',
    message: 'Failed to delete budget line',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_FETCH_FAILED: {
    code: 'ERR_BUDGET_LINE_FETCH_FAILED',
    message: 'Failed to fetch budget lines',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  BUDGET_LINE_BUDGET_MISMATCH: {
    code: 'ERR_BUDGET_LINE_BUDGET_MISMATCH',
    message: 'Budget line does not belong to the specified budget',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  BUDGET_LINE_WITH_TRANSACTIONS: {
    code: 'ERR_BUDGET_LINE_WITH_TRANSACTIONS',
    message: 'Cannot delete budget line with associated transactions',
    httpStatus: HttpStatus.CONFLICT,
  },
  BUDGET_LINE_VALIDATION_FAILED: {
    code: 'ERR_BUDGET_LINE_VALIDATION_FAILED',
    message: 'Budget line validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // User Errors
  USER_NOT_FOUND: {
    code: 'ERR_USER_NOT_FOUND',
    message: 'User not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  USER_UPDATE_FAILED: {
    code: 'ERR_USER_UPDATE_FAILED',
    message: 'Failed to update user',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  USER_FETCH_FAILED: {
    code: 'ERR_USER_FETCH_FAILED',
    message: 'Failed to fetch user',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },

  // Validation Errors
  VALIDATION_FAILED: {
    code: 'ERR_VALIDATION_FAILED',
    message: 'Validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  VALIDATION_ZOD_FAILED: {
    code: 'ERR_ZOD_VALIDATION_FAILED',
    message: 'Request validation failed',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // Database Errors
  DATABASE_CONNECTION_FAILED: {
    code: 'ERR_DATABASE_CONNECTION_FAILED',
    message: 'Database connection failed',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  DATABASE_QUERY_FAILED: {
    code: 'ERR_DATABASE_QUERY_FAILED',
    message: 'Database query failed',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  DATABASE_TRANSACTION_FAILED: {
    code: 'ERR_DATABASE_TRANSACTION_FAILED',
    message: 'Database transaction failed',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
} as const;

// Helper function to get error definition by message (for backward compatibility)
export function getErrorDefinitionByMessage(
  message: string,
): ErrorDefinition | undefined {
  return Object.values(ERROR_DEFINITIONS).find(
    (def) => def.message === message,
  );
}

// Type for error definition keys
export type ErrorDefinitionKey = keyof typeof ERROR_DEFINITIONS;
