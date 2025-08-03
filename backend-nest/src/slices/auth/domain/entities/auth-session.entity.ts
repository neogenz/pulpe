import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { Session } from '../value-objects/session.value-object';
import { AuthToken } from '../value-objects/auth-token.value-object';

export interface AuthSessionProps {
  userId: string;
  email: string;
  session: Session;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSessionSnapshot {
  id: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthSession extends BaseEntity<AuthSessionProps> {
  private _userId: string;
  private _email: string;
  private _session: Session;
  private _ipAddress?: string;
  private _userAgent?: string;

  get userId(): string {
    return this._userId;
  }

  get email(): string {
    return this._email;
  }

  get session(): Session {
    return this._session;
  }

  get ipAddress(): string | undefined {
    return this._ipAddress;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  private constructor(props: AuthSessionProps, id?: string) {
    super(props, id);
    this._userId = props.userId;
    this._email = props.email;
    this._session = props.session;
    this._ipAddress = props.ipAddress;
    this._userAgent = props.userAgent;
  }

  public static create(
    props: AuthSessionProps,
    id?: string,
  ): Result<AuthSession> {
    // Validate user ID
    if (!props.userId || props.userId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'User ID is required',
          'INVALID_AUTH_SESSION',
          'User ID cannot be empty',
        ),
      );
    }

    // Validate email
    if (!props.email || props.email.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Email is required',
          'INVALID_AUTH_SESSION',
          'Email cannot be empty',
        ),
      );
    }

    const authSession = new AuthSession(props, id);
    return Result.ok(authSession);
  }

  public isValid(): boolean {
    return !this._session.isExpired();
  }

  public needsRefresh(): boolean {
    return this._session.isAboutToExpire();
  }

  public refresh(newSession: Session): Result<void> {
    // Ensure the new session is for the same user
    if (newSession.userId !== this._userId) {
      return Result.fail(
        new GenericDomainException(
          'User mismatch',
          'INVALID_REFRESH',
          'Cannot refresh session with different user ID',
        ),
      );
    }

    this._session = newSession;
    this.markAsUpdated();
    return Result.ok();
  }

  public updateDeviceInfo(
    ipAddress?: string,
    userAgent?: string,
  ): Result<void> {
    this._ipAddress = ipAddress;
    this._userAgent = userAgent;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Business rule: Check if this session can perform sensitive operations
   */
  public canPerformSensitiveOperation(): boolean {
    // Session must be valid and not about to expire
    return this.isValid() && !this._session.isAboutToExpire(10);
  }

  public toSnapshot(): AuthSessionSnapshot {
    return {
      id: this.id,
      userId: this._userId,
      email: this._email,
      accessToken: this._session.accessToken,
      refreshToken: this._session.refreshToken,
      expiresAt: this._session.expiresAt,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
