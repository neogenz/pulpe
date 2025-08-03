import { HttpStatus } from '@nestjs/common';
import {
  DomainException,
  ValidationException,
  EntityNotFoundException,
  _ConflictException,
  _UnauthorizedException,
  _ForbiddenException,
  _BusinessRuleViolationException,
  DatabaseException,
  ExternalServiceException,
  TimeoutException,
  RateLimitException,
  _InvalidOperationException,
  MissingDataException,
} from '@/shared/domain/exceptions/domain.exception';
import { ErrorCode, ErrorCodeToStatus } from '../constants/error-codes.enum';

/**
 * Error mapping configuration
 */
export interface ErrorMappingConfig {
  includeStack: boolean;
  includeDetails: boolean;
  sanitizeDatabase: boolean;
}

/**
 * Mapped error structure for HTTP responses
 */
export interface MappedError {
  statusCode: number;
  code: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>;
  stack?: string;
}

/**
 * Utility class for mapping domain exceptions to HTTP errors
 */
export class ErrorMapper {
  private static getDefaultConfig(): ErrorMappingConfig {
    return {
      includeStack: process.env.NODE_ENV === 'development',
      includeDetails: process.env.NODE_ENV === 'development',
      sanitizeDatabase: process.env.NODE_ENV !== 'development',
    };
  }

  /**
   * Maps a domain exception to an HTTP error response
   */
  static mapDomainException(
    exception: DomainException,
    config: Partial<ErrorMappingConfig> = {},
  ): MappedError {
    const mergedConfig = { ...this.getDefaultConfig(), ...config };

    const baseMapping: MappedError = {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
    };

    // Add specific details based on exception type
    if (mergedConfig.includeDetails) {
      baseMapping.details = this.extractExceptionDetails(
        exception,
        mergedConfig,
      );
    }

    // Add stack trace in development
    if (mergedConfig.includeStack && exception.stack) {
      baseMapping.stack = exception.stack;
    }

    return baseMapping;
  }

  /**
   * Maps any error to an HTTP error response
   */
  static mapError(
    error: unknown,
    config: Partial<ErrorMappingConfig> = {},
  ): MappedError {
    if (error instanceof DomainException) {
      return this.mapDomainException(error, config);
    }

    if (error instanceof Error) {
      return this.mapGenericError(error, config);
    }

    return this.mapUnknownError(error, config);
  }

  /**
   * Maps error code to HTTP status
   */
  static getStatusForErrorCode(code: ErrorCode): number {
    return ErrorCodeToStatus[code] || HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Determines if an error should be logged as error level
   */
  static isServerError(error: unknown): boolean {
    if (error instanceof DomainException) {
      return error.statusCode >= 500;
    }
    return true;
  }

  /**
   * Extracts detailed information from specific exception types
   */
  private static extractExceptionDetails(
    exception: DomainException,
    config: ErrorMappingConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details: Record<string, any> = {};

    if (exception instanceof ValidationException) {
      details.errors = exception.errors;
    }

    if (exception instanceof EntityNotFoundException) {
      // Extract entity type and ID from message if possible
      const match = exception.message.match(/(\w+) with id (\w+) not found/);
      if (match) {
        details.entityType = match[1];
        details.entityId = match[2];
      }
    }

    if (exception instanceof DatabaseException) {
      details.operation = exception.operation;
      if (!config.sanitizeDatabase && exception.query) {
        details.query = exception.query;
      }
    }

    if (exception instanceof ExternalServiceException) {
      details.service = exception.service;
      details.endpoint = exception.endpoint;
    }

    if (exception instanceof TimeoutException) {
      details.operation = exception.operation;
      details.timeoutMs = exception.timeoutMs;
    }

    if (exception instanceof RateLimitException) {
      details.limit = exception.limit;
      details.windowMs = exception.windowMs;
      if (exception.retryAfter) {
        details.retryAfter = exception.retryAfter;
      }
    }

    if (exception instanceof MissingDataException) {
      details.field = exception.field;
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  /**
   * Maps generic Error to HTTP error
   */
  private static mapGenericError(
    error: Error,
    config: Partial<ErrorMappingConfig>,
  ): MappedError {
    const mergedConfig = { ...this.getDefaultConfig(), ...config };

    const mapping: MappedError = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: mergedConfig.includeDetails
        ? error.message
        : 'An unexpected error occurred',
    };

    if (mergedConfig.includeStack && error.stack) {
      mapping.stack = error.stack;
    }

    return mapping;
  }

  /**
   * Maps unknown error to HTTP error
   */
  private static mapUnknownError(
    error: unknown,
    config: Partial<ErrorMappingConfig>,
  ): MappedError {
    const mergedConfig = { ...this.getDefaultConfig(), ...config };

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      ...(mergedConfig.includeDetails && {
        details: {
          error: String(error),
          type: typeof error,
        },
      }),
    };
  }

  /**
   * Creates a standardized error response object
   */
  static createErrorResponse(
    mappedError: MappedError,
    request: { path: string; method: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context?: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> {
    return {
      success: false,
      statusCode: mappedError.statusCode,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      message: mappedError.message,
      error: mappedError.code,
      code: mappedError.code,
      ...(mappedError.details && { details: mappedError.details }),
      ...(context && { context }),
      ...(mappedError.stack && { stack: mappedError.stack }),
    };
  }

  /**
   * Sanitizes error message for public consumption
   */
  static sanitizeMessage(message: string): string {
    // If the entire message looks like it contains only sensitive data, redact it completely
    if (
      /^(password|token|api_key|secret|api-key)[\s=:]+\S+$/i.test(
        message.trim(),
      )
    ) {
      return '[REDACTED]';
    }

    // Remove potentially sensitive information
    const patterns = [
      /password[\s=:]+\S+/gi,
      /token[\s=:]+\S+/gi,
      /key[\s=:]+\S+/gi,
      /secret[\s=:]+\S+/gi,
      /api[\s_-]?key[\s=:]+\S+/gi,
    ];

    let sanitized = message;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }
}
