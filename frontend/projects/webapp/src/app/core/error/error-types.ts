import { HttpErrorResponse } from '@angular/common/http';

/**
 * Categories of errors in the application
 * Following KISS principle - only essential categories
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  BUSINESS = 'business',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

/**
 * Structured error representation for the application
 * Provides consistent error handling across the app
 */
export interface PulpeError {
  category: ErrorCategory;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  retryable: boolean;
  originalError?: unknown;
  stack?: string;
}

/**
 * Type guards for error identification
 */
export function isHttpError(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function isDOMException(error: unknown): error is DOMException {
  return error instanceof DOMException;
}

/**
 * Check if error is network related
 */
export function isNetworkError(error: unknown): boolean {
  if (isHttpError(error)) {
    return error.status === 0 || error.status >= 500;
  }

  if (isError(error)) {
    return (
      error.name === 'NetworkError' ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('fetch')
    );
  }

  return false;
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: unknown): boolean {
  if (isHttpError(error)) {
    return error.status === 400 || error.status === 422;
  }

  if (isError(error)) {
    return (
      error.name === 'ValidationError' ||
      error.message.toLowerCase().includes('validation') ||
      error.message.toLowerCase().includes('invalid')
    );
  }

  return false;
}

/**
 * Check if error is business logic related
 */
export function isBusinessError(error: unknown): boolean {
  if (isHttpError(error)) {
    return error.status === 403 || error.status === 409;
  }

  if (isError(error)) {
    return (
      error.name === 'BusinessError' ||
      error.message.toLowerCase().includes('not allowed') ||
      error.message.toLowerCase().includes('unauthorized')
    );
  }

  return false;
}

/**
 * Determine error category from unknown error
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (isNetworkError(error)) return ErrorCategory.NETWORK;
  if (isValidationError(error)) return ErrorCategory.VALIDATION;
  if (isBusinessError(error)) return ErrorCategory.BUSINESS;

  if (isHttpError(error)) {
    if (error.status >= 400 && error.status < 500) {
      return ErrorCategory.VALIDATION;
    }
    if (error.status >= 500) {
      return ErrorCategory.SYSTEM;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const category = categorizeError(error);

  // Network errors are usually retryable
  if (category === ErrorCategory.NETWORK) return true;

  // 5xx errors might be temporary
  if (isHttpError(error) && error.status >= 500) return true;

  // Specific HTTP status codes that are retryable
  if (isHttpError(error)) {
    const retryableStatuses = [408, 429, 502, 503, 504];
    return retryableStatuses.includes(error.status);
  }

  return false;
}

/**
 * Extract error message from unknown error
 */
export function extractErrorMessage(error: unknown): string {
  if (isHttpError(error)) {
    // Try to extract message from response body
    if (error.error?.message) return error.error.message;
    if (error.error?.error) return error.error.error;
    if (typeof error.error === 'string') return error.error;

    // Fallback to status text
    return error.statusText || `HTTP Error ${error.status}`;
  }

  if (isError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>)['message']);
  }

  return 'An unknown error occurred';
}

/**
 * Extract error code if available
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (isHttpError(error)) {
    if (error.error?.code) return error.error.code;
    return `HTTP_${error.status}`;
  }

  if (isError(error) && 'code' in error) {
    return String((error as Record<string, unknown>)['code']);
  }

  return undefined;
}

/**
 * Create a PulpeError from any error
 */
export function createPulpeError(error: unknown): PulpeError {
  return {
    category: categorizeError(error),
    message: extractErrorMessage(error),
    code: extractErrorCode(error),
    timestamp: new Date(),
    retryable: isRetryableError(error),
    originalError: error,
    stack: isError(error) ? error.stack : undefined,
    context: extractErrorContext(error),
  };
}

/**
 * Extract additional context from error
 */
function extractErrorContext(error: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  if (isHttpError(error)) {
    context['url'] = error.url;
    context['status'] = error.status;
    context['statusText'] = error.statusText;
    context['headers'] = error.headers;
  }

  if (isError(error)) {
    context['name'] = error.name;
    const errorWithCause = error as Error & { cause?: unknown };
    if ('cause' in errorWithCause) {
      context['cause'] = errorWithCause.cause;
    }
  }

  return context;
}
