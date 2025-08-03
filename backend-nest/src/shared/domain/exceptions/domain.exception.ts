/**
 * Base class for all domain exceptions
 * Provides structured error information for domain-specific errors
 */
export abstract class DomainException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: Date;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts the exception to a JSON representation
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Thrown when an entity is not found
 */
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName} with id ${id} not found`, 'ENTITY_NOT_FOUND', 404);
  }
}

/**
 * Thrown when a validation rule is violated
 */
export class ValidationException extends DomainException {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    const message = 'Validation failed';
    super(message, 'VALIDATION_FAILED', 400);
    this.errors = errors;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

/**
 * Thrown when a business rule is violated
 */
export class BusinessRuleViolationException extends DomainException {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422);
  }
}

/**
 * Thrown when there's a conflict with the current state
 */
export class ConflictException extends DomainException {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Thrown when an operation is not authorized
 */
export class UnauthorizedException extends DomainException {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Thrown when access to a resource is forbidden
 */
export class ForbiddenException extends DomainException {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Thrown when there's an infrastructure-level error
 */
export abstract class InfrastructureException extends DomainException {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode);
  }
}

/**
 * Thrown when there's a database-related error
 */
export class DatabaseException extends InfrastructureException {
  public readonly query?: string;
  public readonly operation?: string;

  constructor(message: string, operation?: string, query?: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.operation = operation;
    this.query = query;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      // Only include query in development
      ...(process.env.NODE_ENV === 'development' && { query: this.query }),
    };
  }
}

/**
 * Thrown when an external service call fails
 */
export class ExternalServiceException extends InfrastructureException {
  public readonly service: string;
  public readonly endpoint?: string;

  constructor(service: string, message: string, endpoint?: string) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
    );
    this.service = service;
    this.endpoint = endpoint;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      service: this.service,
      endpoint: this.endpoint,
    };
  }
}

/**
 * Thrown when an operation times out
 */
export class TimeoutException extends InfrastructureException {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      504,
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      timeoutMs: this.timeoutMs,
    };
  }
}

/**
 * Thrown when there's an application-level error
 */
export abstract class ApplicationException extends DomainException {
  constructor(message: string, code: string, statusCode: number) {
    super(message, code, statusCode);
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitException extends ApplicationException {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfter?: number;

  constructor(limit: number, windowMs: number, retryAfter?: number) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs / 1000}s`,
      'RATE_LIMIT_EXCEEDED',
      429,
    );
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfter = retryAfter;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      limit: this.limit,
      windowMs: this.windowMs,
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Thrown when an operation is not allowed in the current state
 */
export class InvalidOperationException extends ApplicationException {
  constructor(message: string) {
    super(message, 'INVALID_OPERATION', 422);
  }
}

/**
 * Thrown when required data is missing
 */
export class MissingDataException extends ApplicationException {
  public readonly field: string;

  constructor(field: string) {
    super(`Required data missing: ${field}`, 'MISSING_DATA', 400);
    this.field = field;
  }

  public override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}
