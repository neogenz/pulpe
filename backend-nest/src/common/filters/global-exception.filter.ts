import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
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
  INTERNAL_SERVER_ERROR: 'Internal server error',
  UNKNOWN_EXCEPTION: 'Unknown exception occurred',
} as const;

interface ErrorContext {
  requestId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

interface ProcessedError {
  status: number;
  message: string | object;
  error: string;
  code: string;
  stack?: string;
}

interface StandardizedError {
  success: false;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  code: string;
  message: string | object;
  context?: ErrorContext;
  stack?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const context = this.extractContext(request);
    const errorDetails = this.processException(exception, request, context);
    const errorResponse = this.buildResponse(errorDetails, request, context);

    response.status(errorDetails.status).json(errorResponse);
  }

  private extractContext(request: Request): ErrorContext {
    return {
      requestId: request.headers['x-request-id'] as string,
      userId: (request as Request & { user?: { id: string } }).user?.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
    };
  }

  private processException(
    exception: unknown,
    request: Request,
    context: ErrorContext,
  ): ProcessedError {
    if (exception instanceof ZodValidationException) {
      return this.handleZodException(exception, request, context);
    }
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, request, context);
    }
    if (exception instanceof Error) {
      return this.handleErrorException(exception, request, context);
    }
    return this.handleUnknownException(exception, request, context);
  }

  private handleZodException(
    exception: ZodValidationException,
    request: Request,
    context: ErrorContext,
  ): ProcessedError {
    const status = exception.getStatus();
    const validationErrors = exception.getResponse();

    this.logger.error(ERROR_MESSAGES.ZOD_VALIDATION_FAILED, {
      code: ERROR_CODES.ZOD_VALIDATION_FAILED,
      method: request.method,
      path: request.url,
      requestId: context.requestId,
      userId: context.userId,
      requestBody: request.body,
      validationErrors,
    });

    return {
      status,
      message: validationErrors,
      error: 'ZodValidationException',
      code: ERROR_CODES.ZOD_VALIDATION_FAILED,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleHttpException(
    exception: HttpException,
    request: Request,
    context: ErrorContext,
  ): ProcessedError {
    const status = exception.getStatus();
    const response = exception.getResponse();

    this.logHttpException(status, exception, request, context);

    return {
      status,
      message: this.extractMessage(response),
      error: this.extractError(response, exception),
      code: `HTTP_${status}`,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleErrorException(
    exception: Error,
    request: Request,
    context: ErrorContext,
  ): ProcessedError {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(ERROR_MESSAGES.INTERNAL_SERVER_ERROR, {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      method: request.method,
      path: request.url,
      requestId: context.requestId,
      userId: context.userId,
      error: exception.message,
      stack: exception.stack,
    });

    return {
      status,
      message: this.getErrorMessage(exception),
      error: exception.name || 'InternalServerErrorException',
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleUnknownException(
    exception: unknown,
    request: Request,
    context: ErrorContext,
  ): ProcessedError {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(ERROR_MESSAGES.UNKNOWN_EXCEPTION, {
      code: ERROR_CODES.UNKNOWN_EXCEPTION,
      method: request.method,
      path: request.url,
      requestId: context.requestId,
      userId: context.userId,
      exception: String(exception),
    });

    return {
      status,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: 'UnknownException',
      code: ERROR_CODES.UNKNOWN_EXCEPTION,
    };
  }

  private logHttpException(
    status: number,
    exception: Error,
    request: Request,
    context: ErrorContext,
  ): void {
    const logData = {
      code: `HTTP_${status}`,
      method: request.method,
      path: request.url,
      requestId: context.requestId,
      userId: context.userId,
      statusCode: status,
      error: exception.message,
    };

    if (status >= 500) {
      this.logger.error('HTTP server error', {
        ...logData,
        stack: exception.stack,
      });
    } else if (status >= 400) {
      this.logger.warn('HTTP client error', logData);
    }
  }

  private extractMessage(response: string | object): string | object {
    if (typeof response === 'string') {
      return response;
    }
    return (response as { message?: string }).message || response;
  }

  private extractError(
    response: string | object,
    exception: HttpException,
  ): string {
    if (typeof response === 'string') {
      return exception.name;
    }
    return (response as { error?: string }).error || exception.name;
  }

  private getErrorMessage(exception: Error): string {
    return process.env.NODE_ENV === 'development'
      ? exception.message
      : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
  }

  private getStackInDevelopment(exception: Error): string | undefined {
    return process.env.NODE_ENV === 'development' ? exception.stack : undefined;
  }

  private buildResponse(
    errorDetails: ProcessedError,
    request: Request,
    context: ErrorContext,
  ): StandardizedError {
    const errorResponse: StandardizedError = {
      success: false,
      statusCode: errorDetails.status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: errorDetails.error,
      code: errorDetails.code,
      message: errorDetails.message,
      context: this.sanitizeContext(context),
    };

    if (errorDetails.stack) {
      errorResponse.stack = errorDetails.stack;
    }

    return errorResponse;
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    if (process.env.NODE_ENV === 'production') {
      return {
        requestId: context.requestId,
        userId: context.userId,
      };
    }
    return context;
  }
}
