import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export interface SessionProps {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userId: string;
}

export class Session {
  private readonly _accessToken: string;
  private readonly _refreshToken?: string;
  private readonly _expiresAt: Date;
  private readonly _userId: string;

  get accessToken(): string {
    return this._accessToken;
  }

  get refreshToken(): string | undefined {
    return this._refreshToken;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get userId(): string {
    return this._userId;
  }

  private constructor(props: SessionProps) {
    this._accessToken = props.accessToken;
    this._refreshToken = props.refreshToken;
    this._expiresAt = props.expiresAt;
    this._userId = props.userId;
  }

  public static create(props: SessionProps): Result<Session> {
    // Validate access token
    if (!props.accessToken || props.accessToken.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Access token is required',
          'INVALID_SESSION',
          'Access token cannot be empty',
        ),
      );
    }

    // Validate user ID
    if (!props.userId || props.userId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'User ID is required',
          'INVALID_SESSION',
          'User ID cannot be empty',
        ),
      );
    }

    // Validate expiration date
    if (!props.expiresAt || !(props.expiresAt instanceof Date)) {
      return Result.fail(
        new GenericDomainException(
          'Valid expiration date is required',
          'INVALID_SESSION',
          'Expiration date must be a valid date',
        ),
      );
    }

    // Check if already expired
    if (props.expiresAt <= new Date()) {
      return Result.fail(
        new GenericDomainException(
          'Session already expired',
          'EXPIRED_SESSION',
          'Cannot create a session with past expiration date',
        ),
      );
    }

    return Result.ok(new Session(props));
  }

  public isExpired(): boolean {
    return this._expiresAt <= new Date();
  }

  public isAboutToExpire(thresholdMinutes: number = 5): boolean {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() + thresholdMinutes);
    return this._expiresAt <= threshold;
  }

  public getRemainingTime(): number {
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  public toJSON() {
    return {
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt.toISOString(),
      userId: this._userId,
    };
  }
}
