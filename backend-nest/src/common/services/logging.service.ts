import { Injectable, Scope } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export interface OperationContext {
  operation: string;
  startTime: number;
}

export interface LogContext {
  operation: string;
  userId?: string;
  entityId?: string;
  duration?: number;
  err?: unknown;
  [key: string]: unknown;
}

/**
 * Enhanced logging service with built-in logger context management
 * Can be injected with REQUEST scope for per-request isolation or TRANSIENT for per-injection isolation
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggingService {
  constructor(
    @InjectPinoLogger(LoggingService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Set the logger context for this instance
   * This allows each service to have its own logging context
   */
  setContext(context: string): void {
    this.logger.setContext(context);
  }

  /**
   * Initialize operation context for tracking performance
   */
  initOperationContext(operation: string): OperationContext {
    return {
      operation,
      startTime: Date.now(),
    };
  }

  /**
   * Calculate operation duration
   */
  calculateDuration(startTime: number): number {
    return Date.now() - startTime;
  }

  /**
   * Log successful operation with standard fields
   */
  logSuccess(context: LogContext, message: string): void {
    const { err: _err, ...logData } = context;
    this.logger.info(logData, message);
  }

  /**
   * Log operation error with standard fields
   */
  logError(context: LogContext, message: string): void {
    this.logger.error(context, message);
  }

  /**
   * Log operation warning with standard fields
   */
  logWarn(context: LogContext, message: string): void {
    const { err: _err, ...logData } = context;
    this.logger.warn(logData, message);
  }

  /**
   * Log debug information with standard fields
   */
  logDebug(context: LogContext, message: string): void {
    const { err: _err, ...logData } = context;
    this.logger.debug(logData, message);
  }

  /**
   * Build standard log context
   */
  buildLogContext(
    operation: string,
    userId?: string,
    entityId?: string,
    startTime?: number,
    additionalContext?: Record<string, unknown>,
  ): LogContext {
    return {
      operation,
      ...(userId && { userId }),
      ...(entityId && { entityId }),
      ...(startTime && { duration: this.calculateDuration(startTime) }),
      ...additionalContext,
    };
  }

  /**
   * Re-throw known exceptions while logging unknown errors
   */
  handleError(
    error: unknown,
    context: LogContext,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knownExceptions: Array<new (...args: any[]) => any> = [],
  ): never {
    // Log the error
    this.logError({ ...context, err: error }, message);

    // Re-throw if it's a known exception type
    for (const ExceptionType of knownExceptions) {
      if (error instanceof ExceptionType) {
        throw error;
      }
    }

    // Pour les erreurs inconnues, propage l'erreur originale
    // pour conserver la stack trace, tout en s'assurant qu'elle est loguée.
    throw error;
  }

  /**
   * Convenience method: Log successful operation with context
   */
  logOperationSuccess(
    ctx: OperationContext,
    userId: string,
    entityId: string,
    message: string,
    additionalContext?: Record<string, unknown>,
  ): void {
    this.logSuccess(
      this.buildLogContext(
        ctx.operation,
        userId,
        entityId,
        ctx.startTime,
        additionalContext,
      ),
      message,
    );
  }

  /**
   * Convenience method: Handle and log operation error
   */
  handleOperationError(
    error: unknown,
    ctx: OperationContext,
    userId: string,
    entityId: string,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knownExceptions: Array<new (...args: any[]) => any> = [],
  ): never {
    this.handleError(
      error,
      this.buildLogContext(ctx.operation, userId, entityId, ctx.startTime),
      message,
      knownExceptions,
    );
  }
}
