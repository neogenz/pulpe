/**
 * Public API for error handling infrastructure
 */

// Types and utilities
export {
  ErrorCategory,
  type PulpeError,
  isHttpError,
  isError,
  isDOMException,
  isNetworkError,
  isValidationError,
  isBusinessError,
  categorizeError,
  isRetryableError,
  extractErrorMessage,
  extractErrorCode,
  createPulpeError,
} from './error-types';

// Error handler
export { PulpeErrorHandler, providePulpeErrorHandler } from './error-handler';

// Error manager service
export { ErrorManager } from './error-manager';

// Retry strategy
export {
  RetryStrategy,
  type RetryConfig,
  type RetryStatus,
} from './retry-strategy';
