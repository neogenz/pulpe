import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export class AuthToken {
  private static readonly JWT_REGEX =
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;

  private readonly _value: string;

  get value(): string {
    return this._value;
  }

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value: string): Result<AuthToken> {
    if (!value || value.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Token is required',
          'INVALID_TOKEN',
          'Token cannot be empty',
        ),
      );
    }

    const trimmedValue = value.trim();

    // Remove 'Bearer ' prefix if present
    const tokenValue = trimmedValue.startsWith('Bearer ')
      ? trimmedValue.substring(7)
      : trimmedValue;

    // Basic JWT format validation
    if (!AuthToken.JWT_REGEX.test(tokenValue)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid token format',
          'INVALID_TOKEN',
          'Token must be a valid JWT format',
        ),
      );
    }

    return Result.ok(new AuthToken(tokenValue));
  }

  public equals(other: AuthToken): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  public toBearerToken(): string {
    return `Bearer ${this._value}`;
  }

  public toJSON(): string {
    return this._value;
  }
}
