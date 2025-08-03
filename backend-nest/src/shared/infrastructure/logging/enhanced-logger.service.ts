import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

export interface LogContext {
  userId?: string;
  requestId?: string;
  correlationId?: string;
  entityId?: string;
  entityType?: string;
  operation?: string;
  method?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface OperationLog {
  operationId: string;
  startTime: number;
  context: LogContext;
}

export interface PerformanceThresholds {
  warn: number;
  error: number;
}

const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  warn: 1000, // 1 second
  error: 5000, // 5 seconds
};

@Injectable()
export class EnhancedLoggerService {
  private readonly activeOperations = new Map<string, OperationLog>();
  private readonly performanceThresholds: Map<string, PerformanceThresholds> =
    new Map();

  constructor(
    @InjectPinoLogger(EnhancedLoggerService.name)
    private readonly logger: PinoLogger,
  ) {
    this.setupDefaultThresholds();
  }

  // Delegate methods to PinoLogger for backward compatibility
  error(context: LogContext | Error | string, message?: string): void {
    if (typeof context === 'string') {
      this.logger.error(context);
    } else if (context instanceof Error) {
      this.logger.error({ err: context }, message || context.message);
    } else {
      this.logger.error(context, message || '');
    }
  }

  warn(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.logger.warn(context);
    } else {
      this.logger.warn(context, message || '');
    }
  }

  info(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.logger.info(context);
    } else {
      this.logger.info(context, message || '');
    }
  }

  debug(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.logger.debug(context);
    } else {
      this.logger.debug(context, message || '');
    }
  }

  private setupDefaultThresholds(): void {
    // Database operations
    this.performanceThresholds.set('db.', { warn: 100, error: 1000 });
    this.performanceThresholds.set('db.transaction', {
      warn: 500,
      error: 3000,
    });

    // API operations
    this.performanceThresholds.set('api.', { warn: 300, error: 2000 });
    this.performanceThresholds.set('api.batch', { warn: 1000, error: 5000 });

    // Business operations
    this.performanceThresholds.set('business.', { warn: 50, error: 500 });
    this.performanceThresholds.set('business.validation', {
      warn: 20,
      error: 200,
    });
  }

  /**
   * Start tracking an operation with context
   */
  startOperation(operation: string, context: LogContext = {}): string {
    const operationId = randomUUID();
    const startTime = performance.now();

    const operationLog: OperationLog = {
      operationId,
      startTime,
      context: {
        ...context,
        operation,
        operationId,
      },
    };

    this.activeOperations.set(operationId, operationLog);

    this.logger.info(
      {
        ...operationLog.context,
        event: 'operation_started',
        timestamp: new Date().toISOString(),
      },
      `Started operation: ${operation}`,
    );

    return operationId;
  }

  /**
   * Complete an operation and log performance metrics
   */
  completeOperation(operationId: string, additionalContext?: LogContext): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(
        { operationId },
        'Attempted to complete unknown operation',
      );
      return;
    }

    const duration = performance.now() - operation.startTime;
    const context = {
      ...operation.context,
      ...additionalContext,
      duration,
      durationMs: Math.round(duration),
    };

    this.activeOperations.delete(operationId);

    // Check performance thresholds
    const thresholds = this.getThresholds(
      operation.context.operation as string,
    );
    const logLevel = this.getLogLevelForDuration(duration, thresholds);

    this.logger[logLevel](
      {
        ...context,
        event: 'operation_completed',
        timestamp: new Date().toISOString(),
      },
      `Completed operation: ${operation.context.operation} in ${Math.round(duration)}ms`,
    );
  }

  /**
   * Fail an operation and log error context
   */
  failOperation(
    operationId: string,
    error: Error,
    additionalContext?: LogContext,
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.error(
        {
          operationId,
          err: error,
          ...additionalContext,
        },
        'Failed unknown operation',
      );
      return;
    }

    const duration = performance.now() - operation.startTime;
    const context = {
      ...operation.context,
      ...additionalContext,
      duration,
      durationMs: Math.round(duration),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    };

    this.activeOperations.delete(operationId);

    this.logger.error(
      {
        ...context,
        event: 'operation_failed',
        timestamp: new Date().toISOString(),
        err: error,
      },
      `Failed operation: ${operation.context.operation} after ${Math.round(duration)}ms`,
    );
  }

  /**
   * Log a command execution
   */
  logCommand(
    commandName: string,
    context: LogContext,
    execute: () => Promise<any>,
  ): Promise<any> {
    const operationId = this.startOperation(`command.${commandName}`, {
      ...context,
      commandName,
      type: 'command',
    });

    return execute()
      .then((result) => {
        this.completeOperation(operationId, {
          resultType: result?.constructor?.name || 'unknown',
        });
        return result;
      })
      .catch((error) => {
        this.failOperation(operationId, error);
        throw error;
      });
  }

  /**
   * Log a query execution
   */
  logQuery(
    queryName: string,
    context: LogContext,
    execute: () => Promise<any>,
  ): Promise<any> {
    const operationId = this.startOperation(`query.${queryName}`, {
      ...context,
      queryName,
      type: 'query',
    });

    return execute()
      .then((result) => {
        const resultCount = Array.isArray(result) ? result.length : 1;
        this.completeOperation(operationId, {
          resultCount,
          resultType: result?.constructor?.name || 'unknown',
        });
        return result;
      })
      .catch((error) => {
        this.failOperation(operationId, error);
        throw error;
      });
  }

  /**
   * Log with enriched context
   */
  logWithContext(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    context: LogContext,
  ): void {
    const enrichedContext = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    this.logger[level](enrichedContext, message);
  }

  /**
   * Set custom performance thresholds for an operation type
   */
  setPerformanceThreshold(
    operationType: string,
    thresholds: PerformanceThresholds,
  ): void {
    this.performanceThresholds.set(operationType, thresholds);
  }

  /**
   * Get performance thresholds for an operation
   */
  private getThresholds(operation: string): PerformanceThresholds {
    // Try exact match first
    if (this.performanceThresholds.has(operation)) {
      return this.performanceThresholds.get(operation)!;
    }

    // Try to match by prefix (e.g., 'db.' for 'db.users.findAll')
    for (const [key, thresholds] of this.performanceThresholds) {
      if (operation.startsWith(key)) {
        return thresholds;
      }
    }

    return DEFAULT_PERFORMANCE_THRESHOLDS;
  }

  /**
   * Determine log level based on duration and thresholds
   */
  private getLogLevelForDuration(
    duration: number,
    thresholds: PerformanceThresholds,
  ): 'error' | 'warn' | 'info' {
    if (duration >= thresholds.error) {
      return 'error';
    }
    if (duration >= thresholds.warn) {
      return 'warn';
    }
    return 'info';
  }

  /**
   * Create a child logger with preset context
   */
  createChildLogger(context: LogContext): EnhancedLoggerService {
    const childLogger = Object.create(this);
    childLogger.defaultContext = context;
    return childLogger;
  }

  /**
   * Log structured data for analytics
   */
  logAnalytics(
    event: string,
    properties: Record<string, any>,
    context?: LogContext,
  ): void {
    this.logger.info(
      {
        ...context,
        event,
        properties,
        type: 'analytics',
        timestamp: new Date().toISOString(),
      },
      `Analytics event: ${event}`,
    );
  }

  /**
   * Log audit trail for compliance
   */
  logAudit(
    action: string,
    details: Record<string, any>,
    context: LogContext,
  ): void {
    this.logger.info(
      {
        ...context,
        action,
        details,
        type: 'audit',
        timestamp: new Date().toISOString(),
      },
      `Audit: ${action}`,
    );
  }

  /**
   * Sample logs for high-volume operations
   */
  logSampled(
    sampleRate: number,
    level: 'info' | 'debug',
    message: string,
    context?: LogContext,
  ): void {
    if (Math.random() < sampleRate) {
      this.logWithContext(level, message, context || {});
    }
  }

  /**
   * Generic operation logging method
   */
  async logOperation<T>(options: {
    operation: string;
    context: LogContext;
    logFn: () => Promise<T>;
  }): Promise<T> {
    const { operation, context, logFn } = options;
    const operationId = this.startOperation(operation, context);

    try {
      const result = await logFn();
      this.completeOperation(operationId);
      return result;
    } catch {
      this.failOperation(operationId, error as Error);
      throw error;
    }
  }
}
