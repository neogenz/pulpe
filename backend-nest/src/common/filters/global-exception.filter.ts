import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorContext {
  requestId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

interface StandardizedError {
  success: false;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  message: string | object;
  context?: ErrorContext;
  stack?: string;
  cause?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const context = this.extractErrorContext(request);
    const errorDetails = this.processException(exception, request, context);
    const errorResponse = this.buildErrorResponse(
      errorDetails,
      request,
      context,
    );

    response.status(errorDetails.status).json(errorResponse);
  }

  private formatLogMessage(
    exception: Error,
    request: Request,
    context: ErrorContext,
  ): string {
    const errorDetails = [
      `Error: ${exception.name}`,
      `Message: ${exception.message}`,
      `Path: ${request.method} ${request.url}`,
      `User ID: ${context.userId || 'anonymous'}`,
      `IP: ${context.ip || 'unknown'}`,
      `User Agent: ${context.userAgent || 'unknown'}`,
      context.requestId && `Request ID: ${context.requestId}`,
    ]
      .filter(Boolean)
      .join(' | ');

    return errorDetails;
  }

  private extractErrorContext(request: Request): ErrorContext {
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
  ): {
    status: number;
    message: string | object;
    error: string;
    stack?: string;
    cause?: string;
  } {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, request, context);
    }
    if (exception instanceof Error) {
      return this.handleErrorException(exception, request, context);
    }
    return this.handleUnknownException(exception, request, context);
  }

  private handleHttpException(
    exception: HttpException,
    request: Request,
    context: ErrorContext,
  ) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const stack = exception.stack;
    const cause = exception.cause ? String(exception.cause) : undefined;

    let message: string | object;
    let error: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception.name;
    } else {
      message =
        (exceptionResponse as { message?: string }).message ||
        exceptionResponse;
      error = (exceptionResponse as { error?: string }).error || exception.name;
    }

    this.logHttpException(status, exception, request, context, stack);

    return { status, message, error, stack, cause };
  }

  private handleErrorException(
    exception: Error,
    request: Request,
    context: ErrorContext,
  ) {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      process.env.NODE_ENV === 'development'
        ? exception.message
        : 'Internal server error';
    const error = exception.name || 'InternalServerErrorException';
    const stack = exception.stack;
    const cause = exception.cause ? String(exception.cause) : undefined;

    this.logger.error(
      this.formatLogMessage(exception, request, context),
      stack,
    );

    return { status, message, error, stack, cause };
  }

  private handleUnknownException(
    exception: unknown,
    request: Request,
    context: ErrorContext,
  ) {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = 'Internal server error';
    const error = 'UnknownException';
    const stack = undefined;
    const cause = undefined;

    this.logger.error(
      this.formatLogMessage(new Error(String(exception)), request, context),
    );

    return { status, message, error, stack, cause };
  }

  private logHttpException(
    status: number,
    exception: Error,
    request: Request,
    context: ErrorContext,
    stack?: string,
  ): void {
    if (status >= 500) {
      this.logger.error(
        this.formatLogMessage(exception, request, context),
        stack,
      );
    } else if (status >= 400) {
      this.logger.warn(this.formatLogMessage(exception, request, context));
    }
  }

  private buildErrorResponse(
    errorDetails: {
      status: number;
      message: string | object;
      error: string;
      stack?: string;
      cause?: string;
    },
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
      message: errorDetails.message,
      context: this.sanitizeContext(context),
    };

    if (process.env.NODE_ENV === 'development') {
      if (errorDetails.stack) errorResponse.stack = errorDetails.stack;
      if (errorDetails.cause) errorResponse.cause = errorDetails.cause;
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
