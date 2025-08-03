/**
 * Generic domain exception for domain-specific validation errors
 * Used when a more specific exception type is not available
 */
export class GenericDomainException extends Error {
  public readonly code: string;
  public readonly details?: string;

  constructor(message: string, code: string, details?: string) {
    super(message);
    this.name = 'GenericDomainException';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}
