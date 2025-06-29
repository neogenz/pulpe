import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

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
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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
      requestId: headers['x-request-id'] as string,
      userId: (request as Request & { user?: { id: string } })?.user?.id,
      userAgent: headers['user-agent'],
      ip: request?.ip || request?.connection?.remoteAddress,
    };
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
      stack: GlobalExceptionFilter.getStackInDevelopment(exception),
    };
  }

  private static handleErrorException(exception: Error): ErrorData {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: GlobalExceptionFilter.getErrorMessage(exception),
      error: exception.name || 'InternalServerErrorException',
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
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
    if (typeof response === 'string') {
      return response;
    }
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
    return GlobalExceptionFilter.isDevelopment()
      ? exception.message
      : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
  }

  private static getStackInDevelopment(exception: Error): string | undefined {
    return GlobalExceptionFilter.isDevelopment() ? exception.stack : undefined;
  }

  private static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private logException(
    errorData: ErrorData,
    request: Request,
    context: ErrorContext,
  ): void {
    const baseLogData = {
      code: errorData.code,
      method: request.method,
      path: request.url,
      requestId: context.requestId,
      userId: context.userId,
      statusCode: errorData.status,
    };

    try {
      if (errorData.status >= 500) {
        this.logServerError(errorData, request, baseLogData);
      } else if (errorData.status >= 400) {
        this.logClientError(errorData, baseLogData);
      }
    } catch {
      // Silently ignore logging errors to prevent breaking exception handling
    }
  }

  private logServerError(
    errorData: ErrorData,
    request: Request,
    baseLogData: object,
  ): void {
    const serverLogData = {
      ...baseLogData,
      error: errorData.message,
      stack: errorData.stack,
    };

    if (errorData.code === ERROR_CODES.ZOD_VALIDATION_FAILED) {
      this.logger.error(ERROR_MESSAGES.ZOD_VALIDATION_FAILED, {
        ...serverLogData,
        requestBody: request.body,
        validationErrors: errorData.message,
      });
    } else {
      this.logger.error('Server error occurred', serverLogData);
    }
  }

  private logClientError(errorData: ErrorData, baseLogData: object): void {
    this.logger.warn('Client error occurred', {
      ...baseLogData,
      error: errorData.message,
    });
  }
}
