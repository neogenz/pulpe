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

    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Extract user context if available
    const context: ErrorContext = {
      requestId: request.headers['x-request-id'] as string,
      userId: (request as any).user?.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
    };

    let status: number;
    let message: string | object;
    let error: string;
    let stack: string | undefined;
    let cause: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      error = exception.name;
      stack = exception.stack;
      cause = exception.cause ? String(exception.cause) : undefined;
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = (exceptionResponse as any).message || exceptionResponse;
        error = (exceptionResponse as any).error || exception.name;
      }

      // Log HTTP exceptions with appropriate log level
      if (status >= 500) {
        this.logger.error(this.formatLogMessage(exception, request, context), stack);
      } else if (status >= 400) {
        this.logger.warn(this.formatLogMessage(exception, request, context));
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = process.env.NODE_ENV === 'development' 
        ? exception.message 
        : 'Internal server error';
      error = exception.name || 'InternalServerErrorException';
      stack = exception.stack;
      cause = exception.cause ? String(exception.cause) : undefined;
      
      // Log unexpected errors with full details
      this.logger.error(this.formatLogMessage(exception, request, context), stack);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'UnknownException';
      stack = undefined;
      
      // Log unknown exceptions
      this.logger.error(
        this.formatLogMessage(new Error(String(exception)), request, context)
      );
    }

    const errorResponse: StandardizedError = {
      success: false,
      statusCode: status,
      timestamp,
      path,
      method,
      error,
      message,
      context: this.sanitizeContext(context),
    };

    // Include stack trace in development mode
    if (process.env.NODE_ENV === 'development') {
      if (stack) errorResponse.stack = stack;
      if (cause) errorResponse.cause = cause;
    }

    response.status(status).json(errorResponse);
  }

  private formatLogMessage(
    exception: Error, 
    request: Request, 
    context: ErrorContext
  ): string {
    const errorDetails = [
      `Error: ${exception.name}`,
      `Message: ${exception.message}`,
      `Path: ${request.method} ${request.url}`,
      `User ID: ${context.userId || 'anonymous'}`,
      `IP: ${context.ip || 'unknown'}`,
      `User Agent: ${context.userAgent || 'unknown'}`,
      context.requestId && `Request ID: ${context.requestId}`,
    ].filter(Boolean).join(' | ');

    return errorDetails;
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    // Remove sensitive information from context in production
    if (process.env.NODE_ENV === 'production') {
      return {
        requestId: context.requestId,
        userId: context.userId,
        // Exclude IP and User Agent in production for privacy
      };
    }
    return context;
  }
}