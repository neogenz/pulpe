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
import { resolveHttpLoggingDecision } from '@config/environment';
import {
  sanitizeLogTechnicalValue,
  sanitizeLogValue,
  sanitizeStackFrames,
  toLogPath,
} from '@common/utils/log-anonymization';

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
    // BusinessException is now the priority case and the richest
    if (exception instanceof BusinessException) {
      return this.handleBusinessException(exception);
    }
    if (exception instanceof ZodValidationException) {
      return this.handleZodValidation(exception);
    }
    if (exception instanceof HttpException) {
      // This case handles HttpExceptions that are NOT BusinessExceptions
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
      path: toLogPath(request.url) ?? '',
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
    // Enrich logging context with cause chain
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
          errorType: sanitizeLogTechnicalValue(err.name) ?? 'UnknownError',
          stackFrames: sanitizeStackFrames(err.stack),
        };
      }

      // Handle non-Error objects (like Supabase errors)
      const errObj = err as { name?: string; stack?: string };
      return {
        depth: index + 1,
        errorType: sanitizeLogTechnicalValue(errObj.name) ?? 'UnknownError',
        stackFrames: sanitizeStackFrames(errObj.stack),
      };
    });
  }

  private extractRootCauseInfo(rootCause: Error | unknown): unknown {
    if (!rootCause) return null;

    if (rootCause instanceof Error) {
      return {
        errorType: sanitizeLogTechnicalValue(rootCause.name) ?? 'Error',
        stackFrames: sanitizeStackFrames(rootCause.stack),
      };
    }

    return { errorType: 'UnknownError' };
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
    // Non-HttpException errors are unvetted internals (crypto messages,
    // reflected attacker input): the client gets a stable generic message in
    // every environment; the real message still reaches the logs through
    // originalError.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR.message(),
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

  private getStackInDevelopment(exception: Error): string | undefined {
    return this.isDevelopment() ? exception.stack : undefined;
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private logException(
    errorData: ErrorData,
    request: Request,
    context: ErrorContext,
  ): void {
    const detailedLogging = this.isDetailedHttpLogging();
    const logContext = {
      requestId: context.requestId,
      userId: context.userId,
      method: request.method,
      url: toLogPath(request.url),
      statusCode: errorData.status,
      errorCode: errorData.code,
      errorType: sanitizeLogTechnicalValue(errorData.error) ?? 'Error',
      stackFrames: sanitizeStackFrames(errorData.originalError?.stack),
      userAgent: this.isDevelopment() ? context.userAgent : undefined,
      ip: this.isDevelopment() ? context.ip : undefined,
      requestBody: detailedLogging ? sanitizeLogValue(request.body) : undefined,
      requestQuery: detailedLogging
        ? sanitizeLogValue(request.query)
        : undefined,
      ...errorData.loggingContext,
    };
    const sanitizedLogContext = sanitizeLogValue(logContext) as Record<
      string,
      unknown
    >;

    if (errorData.status >= 500) {
      this.logger.error(sanitizedLogContext, 'SERVER ERROR');
    } else {
      this.logger.warn(sanitizedLogContext, 'CLIENT ERROR');
    }
  }

  private isDetailedHttpLogging(): boolean {
    return (
      resolveHttpLoggingDecision({
        NODE_ENV: process.env.NODE_ENV,
        DEBUG_HTTP_FULL: process.env.DEBUG_HTTP_FULL,
        RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
      }).mode === 'detailed'
    );
  }
}
