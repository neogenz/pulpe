import { HttpException } from '@nestjs/common';
import { ErrorDefinition } from '@common/constants/error-definitions';

/**
 * Business exception that carries structured error context.
 *
 * @example
 * throw new BusinessException(
 *   ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
 *   { id: budgetId }, // Details for client message
 *   { userId: user.id, entityId: budgetId, entityType: 'Budget' } // Context for logs
 * );
 */
export class BusinessException extends HttpException {
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;
  public readonly loggingContext: Record<string, unknown>;
  public override readonly cause: Error | unknown;

  constructor(
    errorDefinition: ErrorDefinition,
    details?: Record<string, unknown>,
    loggingContext: Record<string, unknown> = {},
    options?: { cause?: Error | unknown },
  ) {
    // Generate the final message and send it to parent
    const message = errorDefinition.message(details);

    // Use ES2022 standard 'cause' property if available
    const httpExceptionOptions: { cause?: Error | unknown } = {};
    if (options?.cause) {
      httpExceptionOptions.cause = options.cause;
    }

    super(message, errorDefinition.httpStatus, httpExceptionOptions);

    // Store structured information
    this.name = this.constructor.name;
    this.code = errorDefinition.code;
    this.details = details;
    this.loggingContext = loggingContext;
    // Set cause property for direct access (tests and cause chain methods depend on this)
    this.cause = options?.cause;
  }

  /**
   * Retrieves the complete error cause chain
   */
  getCauseChain(): (Error | unknown)[] {
    const chain: (Error | unknown)[] = [];
    const seen = new WeakSet<object>(); // To avoid circular references
    let current: Error | unknown = this.cause;

    while (current) {
      // WeakSet can only contain objects
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) {
          break; // Circular reference detected
        }
        seen.add(current);
      }

      chain.push(current);

      // Support for Error.cause (ES2022) and common patterns
      if (current && typeof current === 'object') {
        const errorLike = current as Record<string, unknown>;
        current =
          errorLike.cause || errorLike.originalError || errorLike.parentError;
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Retrieves the root cause (the deepest one)
   */
  getRootCause(): Error | unknown {
    const chain = this.getCauseChain();
    return chain.length > 0 ? chain[chain.length - 1] : this.cause;
  }
}
