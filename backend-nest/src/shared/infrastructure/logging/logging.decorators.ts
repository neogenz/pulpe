import { Inject } from '@nestjs/common';
import { EnhancedLoggerService, LogContext } from './enhanced-logger.service';

/**
 * Method decorator for automatic operation logging with performance tracking
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function LogOperation(operationName?: string) {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName =
      operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (
      ...args: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]
    ) {
      const logger: EnhancedLoggerService =
        (this as any).enhancedLogger || (this as any).logger;

      if (!logger || !logger.startOperation) {
        // Fallback to original method if logger not available
        return originalMethod.apply(this, args);
      }

      // Extract context from method arguments if available
      const context: LogContext = {};

      // Check for common parameter patterns
      args.forEach((arg, index) => {
        if (arg && typeof arg === 'object') {
          if ('userId' in arg) context.userId = arg.userId;
          if ('user' in arg && arg.user?.id) context.userId = arg.user.id;
          if ('id' in arg && index === 0) context.entityId = arg.id;
          if ('requestId' in arg) context.requestId = arg.requestId;
        } else if (typeof arg === 'string' && index === 0) {
          // If first argument is a string, assume it's an ID
          context.entityId = arg;
        }
      });

      context.method = propertyKey;
      context.className = target.constructor.name;

      const operationId = logger.startOperation(methodName, context);

      try {
        const result = await originalMethod.apply(this, args);
        logger.completeOperation(operationId, {
          success: true,
          resultType: result?.constructor?.name,
        });
        return result;
      } catch {
        logger.failOperation(operationId, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Method decorator for performance tracking with custom thresholds
 */
export interface PerformanceOptions {
  warnThreshold?: number;
  errorThreshold?: number;
  sampleRate?: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LogPerformance(options: PerformanceOptions = {}) {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName = `${target.constructor.name}.${propertyKey}`;
    const {
      warnThreshold = 1000,
      errorThreshold = 5000,
      sampleRate = 1,
    } = options;

    descriptor.value = async function (
      ...args: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]
    ) {
      // Sample rate check
      if (Math.random() > sampleRate) {
        return originalMethod.apply(this, args);
      }

      const logger: EnhancedLoggerService =
        (this as any).enhancedLogger || (this as any).logger;

      if (!logger || !logger.setPerformanceThreshold) {
        return originalMethod.apply(this, args);
      }

      // Set custom thresholds for this operation
      logger.setPerformanceThreshold(methodName, {
        warn: warnThreshold,
        error: errorThreshold,
      });

      const startTime = performance.now();
      const context: LogContext = {
        method: propertyKey,
        className: target.constructor.name,
      };

      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;

        // Log based on duration
        if (duration >= errorThreshold) {
          logger.logWithContext(
            'error',
            `Performance critical: ${methodName} took ${Math.round(duration)}ms`,
            {
              ...context,
              duration,
              threshold: errorThreshold,
            },
          );
        } else if (duration >= warnThreshold) {
          logger.logWithContext(
            'warn',
            `Performance warning: ${methodName} took ${Math.round(duration)}ms`,
            {
              ...context,
              duration,
              threshold: warnThreshold,
            },
          );
        } else if (sampleRate < 1) {
          // Only log sampled operations that are under threshold in debug
          logger.logWithContext(
            'debug',
            `Performance: ${methodName} completed in ${Math.round(duration)}ms`,
            {
              ...context,
              duration,
            },
          );
        }

        return result;
      } catch {
        const duration = performance.now() - startTime;
        logger.logWithContext(
          'error',
          `Performance: ${methodName} failed after ${Math.round(duration)}ms`,
          {
            ...context,
            duration,
            error: (error as Error).message,
          },
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Method decorator for automatic error logging with context
 */
export interface ErrorLoggingOptions {
  includeStack?: boolean;
  sensitiveParams?: number[]; // Parameter indices to redact
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LogErrors(options: ErrorLoggingOptions = {}) {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName = `${target.constructor.name}.${propertyKey}`;
    const { includeStack = true, sensitiveParams = [] } = options;

    descriptor.value = async function (
      ...args: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]
    ) {
      const logger: EnhancedLoggerService =
        (this as any).enhancedLogger || (this as any).logger;

      try {
        return await originalMethod.apply(this, args);
      } catch {
        if (logger && logger.logWithContext) {
          // Prepare safe args for logging
          const safeArgs = args.map((arg, index) => {
            if (sensitiveParams.includes(index)) {
              return '[REDACTED]';
            }
            // Handle circular references
            try {
              return JSON.parse(JSON.stringify(arg));
            } catch {
              return typeof arg;
            }
          });

          const errorContext: LogContext = {
            method: propertyKey,
            className: target.constructor.name,
            errorName: (error as Error).name,
            errorMessage: (error as Error).message,
            args: safeArgs,
          };

          if (includeStack && (error as Error).stack) {
            errorContext.stack = (error as Error).stack;
          }

          logger.logWithContext(
            'error',
            `Error in ${methodName}: ${(error as Error).message}`,
            errorContext,
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator to inject EnhancedLoggerService
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function UseEnhancedLogger() {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) {
    Inject(EnhancedLoggerService)(target.prototype, 'enhancedLogger');
  };
}

/**
 * Parameter decorator for logging method inputs
 */
export function LogParam(paramName: string) {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    propertyKey: string,
    parameterIndex: number,
  ) {
    const existingMetadata =
      Reflect.getMetadata('log:params', target, propertyKey) || [];
    existingMetadata.push({ index: parameterIndex, name: paramName });
    Reflect.defineMetadata('log:params', existingMetadata, target, propertyKey);
  };
}

/**
 * Method decorator for audit logging
 */
export interface AuditOptions {
  action: string;
  resourceType?: string;
  includeResult?: boolean;
}

export function LogAudit(options: AuditOptions) {
  return function (
    target: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const { action, resourceType, includeResult = false } = options;

    descriptor.value = async function (
      ...args: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]
    ) {
      const logger: EnhancedLoggerService =
        (this as any).enhancedLogger || (this as any).logger;

      if (!logger || !logger.logAudit) {
        return originalMethod.apply(this, args);
      }

      const auditContext: LogContext = {
        method: propertyKey,
        className: target.constructor.name,
        resourceType: resourceType || target.constructor.name,
      };

      // Extract user context
      const userArg = args.find((arg) => arg?.userId || arg?.user?.id);
      if (userArg) {
        auditContext.userId = userArg.userId || userArg.user?.id;
      }

      const auditDetails: Record<string, any> = {
        timestamp: new Date().toISOString(),
        action,
        method: propertyKey,
      };

      try {
        const result = await originalMethod.apply(this, args);

        if (includeResult && result) {
          auditDetails.resultId = result.id || result._id;
          auditDetails.resultType = result.constructor.name;
        }

        logger.logAudit(action, auditDetails, auditContext);

        return result;
      } catch {
        auditDetails.error = (error as Error).message;
        auditDetails.success = false;

        logger.logAudit(`${action}_failed`, auditDetails, auditContext);

        throw error;
      }
    };

    return descriptor;
  };
}
