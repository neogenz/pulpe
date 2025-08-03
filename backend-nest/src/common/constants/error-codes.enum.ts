/**
 * Standardized error codes for the application
 * Used for consistent error identification across the system
 */
export enum ErrorCode {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation (400)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',

  // Resource Not Found (404)
  NOT_FOUND = 'NOT_FOUND',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  BUDGET_NOT_FOUND = 'BUDGET_NOT_FOUND',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',

  // Conflict (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  CONCURRENT_UPDATE = 'CONCURRENT_UPDATE',

  // Business Logic (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_OPERATION = 'INVALID_OPERATION',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Infrastructure (500, 502, 503, 504)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_ERROR = 'CONNECTION_ERROR',

  // Application Specific
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  FEATURE_NOT_IMPLEMENTED = 'FEATURE_NOT_IMPLEMENTED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}

/**
 * Maps error codes to their default HTTP status codes
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  // 400 - Bad Request
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.OUT_OF_RANGE]: 400,

  // 401 - Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,

  // 403 - Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 - Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ENTITY_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.BUDGET_NOT_FOUND]: 404,
  [ErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [ErrorCode.TEMPLATE_NOT_FOUND]: 404,

  // 409 - Conflict
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_RESOURCE]: 409,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.CONCURRENT_UPDATE]: 409,

  // 422 - Unprocessable Entity
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.INVALID_OPERATION]: 422,
  [ErrorCode.INSUFFICIENT_FUNDS]: 422,
  [ErrorCode.BUDGET_EXCEEDED]: 422,
  [ErrorCode.INVALID_STATE_TRANSITION]: 422,

  // 429 - Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  // 500 - Internal Server Error
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,

  // 501 - Not Implemented
  [ErrorCode.FEATURE_NOT_IMPLEMENTED]: 501,

  // 502 - Bad Gateway
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,

  // 503 - Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.MAINTENANCE_MODE]: 503,
  [ErrorCode.CONNECTION_ERROR]: 503,

  // 504 - Gateway Timeout
  [ErrorCode.TIMEOUT]: 504,
};

/**
 * Default error messages for each error code
 */
export const ErrorCodeMessages: Record<ErrorCode, string> = {
  // Authentication & Authorization
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.FORBIDDEN]: 'Access forbidden',
  [ErrorCode.INVALID_TOKEN]: 'Invalid authentication token',
  [ErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]:
    'Insufficient permissions for this operation',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format',
  [ErrorCode.OUT_OF_RANGE]: 'Value is out of acceptable range',

  // Resource Not Found
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.ENTITY_NOT_FOUND]: 'Entity not found',
  [ErrorCode.USER_NOT_FOUND]: 'User not found',
  [ErrorCode.BUDGET_NOT_FOUND]: 'Budget not found',
  [ErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found',
  [ErrorCode.TEMPLATE_NOT_FOUND]: 'Template not found',

  // Conflict
  [ErrorCode.CONFLICT]: 'Request conflicts with current state',
  [ErrorCode.DUPLICATE_RESOURCE]: 'Resource already exists',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.CONCURRENT_UPDATE]: 'Resource was modified by another process',

  // Business Logic
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 'Business rule violation',
  [ErrorCode.INVALID_OPERATION]: 'Operation not allowed',
  [ErrorCode.INSUFFICIENT_FUNDS]: 'Insufficient funds for this operation',
  [ErrorCode.BUDGET_EXCEEDED]: 'Budget limit exceeded',
  [ErrorCode.INVALID_STATE_TRANSITION]: 'Invalid state transition',

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests',

  // Infrastructure
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.DATABASE_ERROR]: 'Database operation failed',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCode.TIMEOUT]: 'Operation timed out',
  [ErrorCode.CONNECTION_ERROR]: 'Connection error',

  // Application Specific
  [ErrorCode.CONFIGURATION_ERROR]: 'Configuration error',
  [ErrorCode.FEATURE_NOT_IMPLEMENTED]: 'Feature not implemented',
  [ErrorCode.MAINTENANCE_MODE]: 'Service is under maintenance',
};
