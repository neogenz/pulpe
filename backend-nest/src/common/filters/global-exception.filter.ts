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
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

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
  readonly details?: Record<string, unknown>;
  readonly loggingContext?: Record<string, unknown>;
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
  readonly details?: Record<string, unknown>;
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

    const context = this.extractRequestContext(request);
    const errorData = this.processException(exception);

    this.logException(errorData, request, context);

    const sanitizedContext = this.sanitizeContext(context);
    const errorResponse = this.buildErrorResponse(
      errorData,
      request,
      sanitizedContext,
    );

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
   * Safely extracts a single string value from a header that can be string or string[]
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
    // La BusinessException est maintenant le cas prioritaire et le plus riche
    if (exception instanceof BusinessException) {
      return this.handleBusinessException(exception);
    }
    if (exception instanceof ZodValidationException) {
      return this.handleZodValidation(exception);
    }
    if (exception instanceof HttpException) {
      // Ce cas gère les HttpException qui NE SONT PAS des BusinessException
      return this.handleHttpException(exception);
    }
    if (exception instanceof Error) {
      return this.handleErrorException(exception);
    }
    return this.handleUnknownException();
  }

  /**
   * Sanitizes context for production environment
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

  private handleZodValidation(exception: ZodValidationException): ErrorData {
    return {
      status: exception.getStatus(),
      message: exception.getResponse(),
      error: 'ZodValidationException',
      code: ERROR_DEFINITIONS.VALIDATION_ZOD_FAILED.code,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleBusinessException(exception: BusinessException): ErrorData {
    // Enrichit le contexte de logging avec la chaîne causale
    const enrichedLoggingContext = {
      ...exception.loggingContext,
      causeChain: this.buildCauseChain(exception),
      rootCause: this.extractRootCauseInfo(exception.getRootCause()),
    };

    return {
      status: exception.getStatus(),
      message: exception.message,
      error: exception.name,
      code: exception.code,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
      details: exception.details,
      loggingContext: enrichedLoggingContext,
    };
  }

  private buildCauseChain(exception: BusinessException): unknown[] {
    return exception.getCauseChain().map((err, index) => {
      if (err instanceof Error) {
        return {
          depth: index + 1,
          name: err.name || 'UnknownError',
          message: err.message || 'No message',
          ...(this.isDevelopment() && err.stack && { stack: err.stack }),
        };
      }

      // Handle non-Error objects (like Supabase errors)
      const errObj = err as { name?: string; message?: string; stack?: string };
      return {
        depth: index + 1,
        name: errObj.name || 'UnknownError',
        message: errObj.message || JSON.stringify(err),
        ...(this.isDevelopment() && errObj.stack && { stack: errObj.stack }),
      };
    });
  }

  private extractRootCauseInfo(rootCause: Error | unknown): unknown {
    if (!rootCause) return null;

    if (rootCause instanceof Error) {
      return {
        name: rootCause.name,
        message: rootCause.message,
        ...(this.isDevelopment() && { stack: rootCause.stack }),
      };
    }

    return { value: rootCause };
  }

  private handleHttpException(exception: HttpException): ErrorData {
    const response = exception.getResponse();
    const message = this.extractHttpMessage(response);

    return {
      status: exception.getStatus(),
      message,
      error: this.extractHttpError(response, exception),
      code: `HTTP_${exception.getStatus()}`,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleErrorException(exception: Error): ErrorData {
    const message = this.getErrorMessage(exception);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      error: exception.name || 'InternalServerErrorException',
      code: ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR.code,
      originalError: exception,
      stack: this.getStackInDevelopment(exception),
    };
  }

  private handleUnknownException(): ErrorData {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_DEFINITIONS.UNKNOWN_EXCEPTION.message(),
      error: 'UnknownException',
      code: ERROR_DEFINITIONS.UNKNOWN_EXCEPTION.code,
    };
  }

  private extractHttpMessage(response: string | object): string | object {
    return response;
  }

  private extractHttpError(
    response: string | object,
    exception: HttpException,
  ): string {
    if (typeof response === 'string') {
      return exception.name;
    }
    return (response as { error?: string }).error || exception.name;
  }

  private getErrorMessage(exception: Error): string {
    return (
      exception.message || ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR.message()
    );
  }

  private getStackInDevelopment(exception: Error): string | undefined {
    return this.isDevelopment() ? exception.stack : undefined;
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Sanitizes request body for logging by removing sensitive fields
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
      userAgent: this.isDevelopment() ? context.userAgent : undefined,
      ip: this.isDevelopment() ? context.ip : undefined,
      requestBody: this.sanitizeRequestBody(request.body),
      ...errorData.loggingContext, // Fusionne le contexte fourni par le service
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
