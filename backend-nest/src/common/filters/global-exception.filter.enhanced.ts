import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';
import { ErrorMapper } from '../utils/error-mapper';
import { ErrorCode } from '../constants/error-codes.enum';

interface ErrorContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly userAgent?: string;
  readonly ip?: string;
}

interface ErrorData {
  readonly status: number;
  readonly message: string | object;
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, any>;
  readonly originalError?: Error;
  readonly stack?: string;
}

interface ErrorResponse {
  readonly success: false;
  readonly statusCode: number;
  readonly timestamp: string;
  readonly path: string;
  readonly method: string;
  readonly message: string | object;
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, any>;
  readonly context?: ErrorContext;
  stack?: string;
}

/**
 * Enhanced global exception filter with domain exception support
 * Provides better error categorization, structured responses, and context-aware logging
 */
@Injectable()
@Catch()
export class GlobalExceptionFilterEnhanced implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilterEnhanced.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Catches all exceptions and returns standardized error responses
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const context = this.extractRequestContext(request);
    const errorData = this.processException(exception);

    this.logException(errorData, request, context);

    const sanitizedContext = this.sanitizeContext(context);
    const errorResponse = this.buildErrorResponse(
      errorData,
      request,
      sanitizedContext,
    );

    // Set additional headers for specific error types
    this.setResponseHeaders(response, errorData);

    response.status(errorData.status).json(errorResponse);
  }

  /**
   * Extracts context information from HTTP request
   */
  private extractRequestContext(request: Request): ErrorContext {
    const headers = request?.headers || {};
    return {
      requestId: this.extractHeaderValue(headers['x-request-id']),
      userId: (request as Request & { user?: { id: string } })?.user?.id,
      userAgent: this.extractHeaderValue(headers['user-agent']),
      ip: request?.ip || request?.connection?.remoteAddress,
    };
  }

  /**
   * Safely extracts a single string value from a header
   */
  private extractHeaderValue(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (!headerValue) {
      return undefined;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0] || undefined;
    }
    return headerValue;
  }

  /**
   * Processes any exception and returns structured error data
   */
  private processException(exception: unknown): ErrorData {
    // Domain exceptions (our custom exceptions)
    if (exception instanceof DomainException) {
      return this.handleDomainException(exception);
    }

    // Zod validation exceptions
    if (exception instanceof ZodValidationException) {
      return this.handleZodValidation(exception);
    }

    // NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    // Generic errors
    if (exception instanceof Error) {
      return this.handleErrorException(exception);
    }

    // Unknown errors
    return this.handleUnknownException(exception);
  }

  /**
   * Handles domain exceptions with proper mapping
   */
  private handleDomainException(exception: DomainException): ErrorData {
    const mapped = ErrorMapper.mapDomainException(exception);

    return {
      status: mapped.statusCode,
      message: ErrorMapper.sanitizeMessage(mapped.message),
      error: exception.name,
      code: mapped.code,
      details: mapped.details,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  /**
   * Handles Zod validation exceptions
   */
  private handleZodValidation(exception: ZodValidationException): ErrorData {
    const response = exception.getResponse() as any;
    const errors = response.errors || [];

    // Transform Zod errors to our format
    const validationDetails: Record<string, string[]> = {};
    errors.forEach(
      (
        error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => {
        const path = error.path.join('.');
        if (!validationDetails[path]) {
          validationDetails[path] = [];
        }
        validationDetails[path].push(error.message);
      },
    );

    return {
      status: exception.getStatus(),
      message: 'Validation failed',
      error: 'ValidationException',
      code: ErrorCode.VALIDATION_FAILED,
      details: {
        errors: validationDetails,
        zodErrors: errors,
      },
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  /**
   * Handles NestJS HTTP exceptions
   */
  private handleHttpException(exception: HttpException): ErrorData {
    const response = exception.getResponse();
    const status = exception.getStatus();

    // Map status to error code
    const code = this.mapStatusToErrorCode(status);

    return {
      status,
      message: this.extractHttpMessage(response),
      error: this.extractHttpError(response, exception),
      code,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  /**
   * Handles generic Error instances
   */
  private handleErrorException(exception: Error): ErrorData {
    // Check if it's a database error
    if (this.isDatabaseError(exception)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isDevelopment()
          ? exception.message
          : 'Database operation failed',
        error: 'DatabaseException',
        code: ErrorCode.DATABASE_ERROR,
        originalError: exception,
        stack: this.getStackInDevelopment(exception),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.getErrorMessage(exception),
      error: exception.name || 'InternalServerErrorException',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  /**
   * Handles unknown exceptions
   */
  private handleUnknownException(exception: unknown): ErrorData {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'UnknownException',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      details: this.isDevelopment() ? { error: String(exception) } : undefined,
    };
  }

  /**
   * Builds standardized error response
   */
  private buildErrorResponse(
    errorData: ErrorData,
    request: Request,
    context: ErrorContext,
  ): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      statusCode: errorData.status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: errorData.message,
      error: errorData.error,
      code: errorData.code,
      context,
      ...(errorData.details && { details: errorData.details }),
      ...(errorData.stack && { stack: errorData.stack }),
    };

    return response;
  }

  /**
   * Sets additional response headers based on error type
   */
  private setResponseHeaders(response: Response, errorData: ErrorData): void {
    // Add retry-after header for rate limit errors
    if (
      errorData.code === ErrorCode.RATE_LIMIT_EXCEEDED &&
      errorData.details?.retryAfter
    ) {
      response.setHeader('Retry-After', errorData.details.retryAfter);
    }

    // Add cache control for client errors
    if (errorData.status >= 400 && errorData.status < 500) {
      response.setHeader(
        'Cache-Control',
        'no-cache, no-store, must-revalidate',
      );
    }
  }

  /**
   * Logs exception with appropriate level and context
   */
  private logException(
    errorData: ErrorData,
    request: Request,
    context: ErrorContext,
  ): void {
    const logContext = {
      operation: 'exception_handling',
      requestId: context.requestId,
      userId: context.userId,
      method: request.method,
      url: request.url,
      statusCode: errorData.status,
      errorCode: errorData.code,
      errorType: errorData.error,
      userAgent: this.isDevelopment() ? context.userAgent : undefined,
      ip: this.isDevelopment() ? context.ip : undefined,
      requestBody: this.isDevelopment()
        ? this.sanitizeRequestBody(request.body)
        : undefined,
      details: errorData.details,
    };

    const errorMessage = this.extractReadableMessage(errorData.message);

    if (errorData.status >= 500) {
      // Server errors: log as error with full context
      this.logger.error(
        {
          ...logContext,
          err: errorData.originalError || new Error(errorMessage),
        },
        `Server error: ${errorMessage}`,
      );
    } else if (errorData.status >= 400) {
      // Client errors: log as warning
      this.logger.warn(logContext, `Client error: ${errorMessage}`);
    } else {
      // Other errors: log as info
      this.logger.info(logContext, `Request error: ${errorMessage}`);
    }
  }

  /**
   * Sanitizes request body for logging
   */
  private sanitizeRequestBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'authorization',
      'auth',
      'apiKey',
      'creditCard',
      'ssn',
    ];

    const sanitized = { ...body } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes context for production
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    if (this.isDevelopment()) {
      return context;
    }
    return {
      requestId: context.requestId,
      userId: context.userId,
    };
  }

  /**
   * Maps HTTP status to error code
   */
  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.INVALID_INPUT;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 422:
        return ErrorCode.BUSINESS_RULE_VIOLATION;
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      case 500:
        return ErrorCode.INTERNAL_SERVER_ERROR;
      case 502:
        return ErrorCode.EXTERNAL_SERVICE_ERROR;
      case 503:
        return ErrorCode.SERVICE_UNAVAILABLE;
      case 504:
        return ErrorCode.TIMEOUT;
      default:
        return `HTTP_${status}`;
    }
  }

  /**
   * Checks if error is database-related
   */
  private isDatabaseError(error: Error): boolean {
    const dbErrorPatterns = [
      /supabase/i,
      /postgres/i,
      /pg_/i,
      /duplicate key/i,
      /foreign key/i,
      /constraint/i,
      /relation .* does not exist/i,
    ];

    return dbErrorPatterns.some(
      (pattern) =>
        pattern.test(error.message) || pattern.test(error.stack || ''),
    );
  }

  /**
   * Extracts HTTP message from response
   */
  private extractHttpMessage(response: string | object): string | object {
    if (typeof response === 'string') {
      return response;
    }
    return (response as any).message || response;
  }

  /**
   * Extracts HTTP error name
   */
  private extractHttpError(
    response: string | object,
    exception: HttpException,
  ): string {
    if (typeof response === 'string') {
      return exception.name;
    }
    return (response as any).error || exception.name;
  }

  /**
   * Gets error message with fallback
   */
  private getErrorMessage(exception: Error): string {
    return this.isDevelopment() ? exception.message : 'Internal server error';
  }

  /**
   * Gets stack trace in development only
   */
  private getStackInDevelopment(exception: Error): string | undefined {
    return this.isDevelopment() ? exception.stack : undefined;
  }

  /**
   * Checks if running in development mode
   */
  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Extracts readable message from various formats
   */
  private extractReadableMessage(message: string | object): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message && typeof message === 'object') {
      const msgObj = message as any;

      // Handle validation errors
      if (msgObj.errors && Array.isArray(msgObj.errors)) {
        const validationDetails = msgObj.errors
          .map(
            (
              error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
            ) => `${error.path?.join('.') || 'field'}: ${error.message}`,
          )
          .join(', ');

        const baseMessage = msgObj.message || 'Validation failed';
        return `${baseMessage} - ${validationDetails}`;
      }

      return (
        msgObj.message ||
        msgObj.error ||
        msgObj.detail ||
        JSON.stringify(msgObj)
      );
    }

    return 'Unknown error';
  }
}
