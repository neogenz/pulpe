import { PinoLogger } from 'nestjs-pino';
import { Result } from '@/shared/domain/result';
import {
  DomainException,
  DatabaseException,
  ExternalServiceException,
  TimeoutException,
  ConflictException,
  ValidationException,
} from '@/shared/domain/exceptions/domain.exception';

/**
 * Error handling context for operations
 */
export interface ErrorHandlingContext {
  operation: string;
  userId?: string;
  entityId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Options for error handling
 */
export interface ErrorHandlingOptions {
  logLevel?: 'error' | 'warn' | 'info';
  rethrow?: boolean;

  fallbackValue?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  transformError?: (error: Error) => Error;
}

/**
 * Utility class for consistent error handling across services
 */
export class ErrorHandler {
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Wraps an async operation with error handling
   */
  async handleAsync<T>(
    operation: () => Promise<T>,
    context: ErrorHandlingContext,
    options: ErrorHandlingOptions = {},
  ): Promise<T> {
    const startTime = Date.now();
    const logContext = {
      operation: context.operation,
      userId: context.userId,
      entityId: context.entityId,
      ...context.metadata,
    };

    try {
      this.logger.debug(logContext, `Starting operation: ${context.operation}`);

      const result = await operation();

      const duration = Date.now() - startTime;
      this.logger.info(
        { ...logContext, duration },
        `Operation completed: ${context.operation}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.handleError(error, context, { ...options, duration });
    }
  }

  /**
   * Wraps a sync operation with error handling
   */
  handle<T>(
    operation: () => T,
    context: ErrorHandlingContext,
    options: ErrorHandlingOptions = {},
  ): T {
    const startTime = Date.now();
    const logContext = {
      operation: context.operation,
      userId: context.userId,
      entityId: context.entityId,
      ...context.metadata,
    };

    try {
      this.logger.debug(logContext, `Starting operation: ${context.operation}`);

      const result = operation();

      const duration = Date.now() - startTime;
      this.logger.info(
        { ...logContext, duration },
        `Operation completed: ${context.operation}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.handleError(error, context, { ...options, duration });
    }
  }

  /**
   * Wraps an operation that returns a Result
   */
  async handleResult<T>(
    operation: () => Promise<Result<T>>,
    context: ErrorHandlingContext,
  ): Promise<Result<T>> {
    const startTime = Date.now();
    const logContext = {
      operation: context.operation,
      userId: context.userId,
      entityId: context.entityId,
      ...context.metadata,
    };

    try {
      this.logger.debug(logContext, `Starting operation: ${context.operation}`);

      const result = await operation();

      const duration = Date.now() - startTime;

      if (result.isSuccess) {
        this.logger.info(
          { ...logContext, duration },
          `Operation succeeded: ${context.operation}`,
        );
      } else {
        this.logger.warn(
          { ...logContext, duration, error: result.error },
          `Operation failed: ${context.operation}`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          ...logContext,
          duration,
          err: error instanceof Error ? error : new Error(String(error)),
        },
        `Operation error: ${context.operation}`,
      );

      return Result.fail(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Handles database operations with specific error transformation
   */
  async handleDatabase<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Omit<ErrorHandlingContext, 'operation'>,
  ): Promise<T> {
    return await this.handleAsync(
      operation,
      { ...context, operation: `database.${operationName}` },
      {
        transformError: (error) =>
          this.transformDatabaseError(error, operationName),
      },
    );
  }

  /**
   * Handles external service calls with timeout and error transformation
   */
  async handleExternalService<T>(
    operation: () => Promise<T>,
    serviceName: string,
    endpoint: string,
    timeoutMs: number,
    context: Omit<ErrorHandlingContext, 'operation'>,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutException(`${serviceName}.${endpoint}`, timeoutMs));
      }, timeoutMs);
    });

    return await this.handleAsync(
      () => Promise.race([operation(), timeoutPromise]),
      { ...context, operation: `external.${serviceName}.${endpoint}` },
      {
        transformError: (error) =>
          this.transformExternalServiceError(error, serviceName, endpoint),
      },
    );
  }

  /**
   * Handles multiple operations in parallel with individual error handling
   */
  async handleParallel<T>(
    operations: Array<{
      operation: () => Promise<T>;
      context: ErrorHandlingContext;
      options?: ErrorHandlingOptions;
    }>,
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const results = await Promise.allSettled(
      operations.map(({ operation, context, options }) =>
        this.handleAsync(operation, context, { ...options, rethrow: false }),
      ),
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return { success: true, result: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  }

  /**
   * Central error handling logic
   */
  private handleError<T>(
    error: unknown,
    context: ErrorHandlingContext,
    options: ErrorHandlingOptions & { duration?: number },
  ): T {
    const {
      logLevel = 'error',
      rethrow = true,
      fallbackValue,
      transformError,
      duration,
    } = options;

    let processedError: Error;

    if (error instanceof Error) {
      processedError = transformError ? transformError(error) : error;
    } else {
      processedError = new Error(String(error));
    }

    const logContext = {
      operation: context.operation,
      userId: context.userId,
      entityId: context.entityId,
      duration,
      errorType: processedError.constructor.name,
      errorCode: (processedError as any).code,
      ...context.metadata,
    };

    // Log based on error type and options
    if (
      processedError instanceof DomainException &&
      processedError.statusCode < 500
    ) {
      this.logger.warn(
        { ...logContext, err: processedError },
        `Business error in ${context.operation}: ${processedError.message}`,
      );
    } else {
      this.logger[logLevel](
        { ...logContext, err: processedError },
        `Error in ${context.operation}: ${processedError.message}`,
      );
    }

    if (rethrow) {
      throw processedError;
    }

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    throw processedError;
  }

  /**
   * Transforms database errors to domain exceptions
   */
  private transformDatabaseError(error: Error, operation: string): Error {
    // Check for specific database error patterns
    if (error.message.includes('duplicate key')) {
      const match = error.message.match(/Key \((.*?)\)=/);
      const field = match ? match[1] : 'field';
      return new ConflictException(`Duplicate value for ${field}`);
    }

    if (error.message.includes('foreign key constraint')) {
      return new ValidationException({
        reference: ['Referenced entity does not exist'],
      });
    }

    if (error.message.includes('not-null constraint')) {
      const match = error.message.match(/column "(.*?)"/);
      const field = match ? match[1] : 'field';
      return new ValidationException({
        [field]: [`Required field '${field}' is missing`],
      });
    }

    return new DatabaseException(error.message, operation);
  }

  /**
   * Transforms external service errors to domain exceptions
   */

  private transformExternalServiceError(
    error: Error,
    service: string,
    endpoint: string,
  ): Error {
    if (error instanceof TimeoutException) {
      return error;
    }

    if (error.message.includes('ECONNREFUSED')) {
      return new ExternalServiceException(
        service,
        'Service unavailable',
        endpoint,
      );
    }

    if (error.message.includes('ETIMEDOUT')) {
      return new TimeoutException(`${service}.${endpoint}`, 30000);
    }

    return new ExternalServiceException(service, error.message, endpoint);
  }

  /**
   * Creates a scoped error handler for a specific service
   */
  static forService(serviceName: string, logger: PinoLogger): ErrorHandler {
    logger.setContext(serviceName);
    return new ErrorHandler(logger);
  }
}
