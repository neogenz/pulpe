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

const ERROR_CODES = {
  ZOD_VALIDATION_FAILED: 'ZOD_VALIDATION_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNKNOWN_EXCEPTION: 'UNKNOWN_EXCEPTION',
} as const;

const ERROR_MESSAGES = {
  ZOD_VALIDATION_FAILED: 'Validation failed',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  UNKNOWN_EXCEPTION: 'An unexpected error occurred',
} as const;

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
  readonly context?: ErrorContext;
  stack?: string;
}

/**
 * Global exception filter that standardizes error responses and logging
 * Handles Zod validation, HTTP exceptions, and unexpected errors
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Catches all exceptions and returns standardized error responses
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const context = GlobalExceptionFilter.extractRequestContext(request);
    const errorData = GlobalExceptionFilter.processException(exception);

    this.logException(errorData, request, context);

    const sanitizedContext = GlobalExceptionFilter.sanitizeContext(context);
    const errorResponse = GlobalExceptionFilter.buildErrorResponse(
      errorData,
      request,
      sanitizedContext,
    );

    response.status(errorData.status).json(errorResponse);
  }

  /**
   * Extracts context information from HTTP request
   */
  static extractRequestContext(request: Request): ErrorContext {
    const headers = request?.headers || {};
    return {
      requestId: GlobalExceptionFilter.extractHeaderValue(
        headers['x-request-id'],
      ),
      userId: (request as Request & { user?: { id: string } })?.user?.id,
      userAgent: GlobalExceptionFilter.extractHeaderValue(
        headers['user-agent'],
      ),
      ip: request?.ip || request?.connection?.remoteAddress,
    };
  }

  /**
   * Safely extracts a single string value from a header that can be string or string[]
   */
  private static extractHeaderValue(
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
  static processException(exception: unknown): ErrorData {
    if (exception instanceof ZodValidationException) {
      return GlobalExceptionFilter.handleZodValidation(exception);
    }
    if (exception instanceof HttpException) {
      return GlobalExceptionFilter.handleHttpException(exception);
    }
    if (exception instanceof Error) {
      return GlobalExceptionFilter.handleErrorException(exception);
    }
    return GlobalExceptionFilter.handleUnknownException();
  }

  /**
   * Sanitizes context for production environment
   */
  static sanitizeContext(context: ErrorContext): ErrorContext {
    if (GlobalExceptionFilter.isDevelopment()) {
      return context;
    }
    return {
      requestId: context.requestId,
      userId: context.userId,
    };
  }

  /**
   * Builds standardized error response
   */
  static buildErrorResponse(
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
    };

    if (errorData.stack) {
      response.stack = errorData.stack;
    }

    return response;
  }

  private static handleZodValidation(
    exception: ZodValidationException,
  ): ErrorData {
    return {
      status: exception.getStatus(),
      message: exception.getResponse(),
      error: 'ZodValidationException',
      code: ERROR_CODES.ZOD_VALIDATION_FAILED,
      originalError: exception,
      stack: GlobalExceptionFilter.getStackInDevelopment(exception),
    };
  }

  private static handleHttpException(exception: HttpException): ErrorData {
    const response = exception.getResponse();
    return {
      status: exception.getStatus(),
      message: GlobalExceptionFilter.extractHttpMessage(response),
      error: GlobalExceptionFilter.extractHttpError(response, exception),
      code: `HTTP_${exception.getStatus()}`,
      originalError: exception,
      stack: GlobalExceptionFilter.getStackInDevelopment(exception),
    };
  }

  private static handleErrorException(exception: Error): ErrorData {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: GlobalExceptionFilter.getErrorMessage(exception),
      error: exception.name || 'InternalServerErrorException',
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      originalError: exception,
      stack: GlobalExceptionFilter.getStackInDevelopment(exception),
    };
  }

  private static handleUnknownException(): ErrorData {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.UNKNOWN_EXCEPTION,
      error: 'UnknownException',
      code: ERROR_CODES.UNKNOWN_EXCEPTION,
    };
  }

  private static extractHttpMessage(
    response: string | object,
  ): string | object {
    return response;
  }

  private static extractHttpError(
    response: string | object,
    exception: HttpException,
  ): string {
    if (typeof response === 'string') {
      return exception.name;
    }
    return (response as { error?: string }).error || exception.name;
  }

  private static getErrorMessage(exception: Error): string {
    return exception.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
  }

  private static getStackInDevelopment(exception: Error): string | undefined {
    return GlobalExceptionFilter.isDevelopment() ? exception.stack : undefined;
  }

  private static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Sanitizes request body for logging by removing sensitive fields
   */
  private static sanitizeRequestBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'authorization',
      'auth',
    ];
    const sanitized = { ...body } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private logException(
    errorData: ErrorData,
    request: Request,
    context: ErrorContext,
  ): void {
    const logContext = {
      requestId: context.requestId,
      userId: context.userId,
      method: request.method,
      url: request.url,
      statusCode: errorData.status,
      errorCode: errorData.code,
      userAgent: GlobalExceptionFilter.isDevelopment()
        ? context.userAgent
        : undefined,
      ip: GlobalExceptionFilter.isDevelopment() ? context.ip : undefined,
      requestBody: GlobalExceptionFilter.sanitizeRequestBody(request.body),
    };

    // Extract readable message from errorData.message
    const errorMessage = this.extractReadableMessage(errorData.message);

    if (errorData.status >= 500) {
      // Server errors: log with structured context including error object
      this.logger.error(
        {
          ...logContext,
          err: errorData.originalError || new Error(errorMessage),
        },
        `SERVER ERROR: ${errorMessage}`,
      );
    } else {
      // Client errors: log as warning with structured context
      this.logger.warn(logContext, `CLIENT ERROR: ${errorMessage}`);
    }
  }

  private extractReadableMessage(message: string | object): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message && typeof message === 'object') {
      const msgObj = message as unknown as {
        message?: string;
        error?: string;
        detail?: string;
        errors?: Array<{
          code: string;
          message: string;
          path: (string | number)[];
        }>;
      };

      // Handle Zod validation errors with detailed information
      if (msgObj.errors && Array.isArray(msgObj.errors)) {
        const validationDetails = msgObj.errors
          .map((error) => `${error.path.join('.')}: ${error.message}`)
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
