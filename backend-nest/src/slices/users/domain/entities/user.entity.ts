import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export interface UserProps {
  email: string;
  firstName?: string;
  lastName?: string;
  onboardingCompleted: boolean;
  metadata?: Record<string, any>;
}

export interface UserSnapshot {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  onboardingCompleted: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends BaseEntity<UserProps> {
  private static readonly NAME_MAX_LENGTH = 50;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private _email: string;
  private _firstName?: string;
  private _lastName?: string;
  private _onboardingCompleted: boolean;
  private _metadata: Record<string, any>;

  get email(): string {
    return this._email;
  }

  get firstName(): string | undefined {
    return this._firstName;
  }

  get lastName(): string | undefined {
    return this._lastName;
  }

  get fullName(): string | undefined {
    if (!this._firstName && !this._lastName) return undefined;
    return [this._firstName, this._lastName].filter(Boolean).join(' ');
  }

  get onboardingCompleted(): boolean {
    return this._onboardingCompleted;
  }

  get metadata(): Record<string, any> {
    return { ...this._metadata };
  }

  private constructor(props: UserProps, id?: string) {
    super(props, id);
    this._email = props.email;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._onboardingCompleted = props.onboardingCompleted;
    this._metadata = props.metadata || {};
  }

  public static create(props: UserProps, id?: string): Result<User> {
    // Validate email
    if (!props.email || props.email.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Email is required',
          'INVALID_USER',
          'Email cannot be empty',
        ),
      );
    }

    if (!User.EMAIL_REGEX.test(props.email)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid email format',
          'INVALID_USER',
          'Email must be a valid email address',
        ),
      );
    }

    // Validate firstName if provided
    if (props.firstName !== undefined) {
      if (props.firstName.trim() === '') {
        return Result.fail(
          new GenericDomainException(
            'First name cannot be empty',
            'INVALID_USER',
            'First name must contain at least one character',
          ),
        );
      }

      if (props.firstName.length > User.NAME_MAX_LENGTH) {
        return Result.fail(
          new GenericDomainException(
            'First name too long',
            'INVALID_USER',
            `First name cannot exceed ${User.NAME_MAX_LENGTH} characters`,
          ),
        );
      }
    }

    // Validate lastName if provided
    if (props.lastName !== undefined) {
      if (props.lastName.trim() === '') {
        return Result.fail(
          new GenericDomainException(
            'Last name cannot be empty',
            'INVALID_USER',
            'Last name must contain at least one character',
          ),
        );
      }

      if (props.lastName.length > User.NAME_MAX_LENGTH) {
        return Result.fail(
          new GenericDomainException(
            'Last name too long',
            'INVALID_USER',
            `Last name cannot exceed ${User.NAME_MAX_LENGTH} characters`,
          ),
        );
      }
    }

    const user = new User(props, id);
    return Result.ok(user);
  }

  public updateProfile(firstName?: string, lastName?: string): Result<void> {
    // Validate firstName if provided
    if (firstName !== undefined) {
      if (firstName.trim() === '') {
        return Result.fail(
          new GenericDomainException(
            'First name cannot be empty',
            'INVALID_USER_UPDATE',
            'First name must contain at least one character',
          ),
        );
      }

      if (firstName.length > User.NAME_MAX_LENGTH) {
        return Result.fail(
          new GenericDomainException(
            'First name too long',
            'INVALID_USER_UPDATE',
            `First name cannot exceed ${User.NAME_MAX_LENGTH} characters`,
          ),
        );
      }
    }

    // Validate lastName if provided
    if (lastName !== undefined) {
      if (lastName.trim() === '') {
        return Result.fail(
          new GenericDomainException(
            'Last name cannot be empty',
            'INVALID_USER_UPDATE',
            'Last name must contain at least one character',
          ),
        );
      }

      if (lastName.length > User.NAME_MAX_LENGTH) {
        return Result.fail(
          new GenericDomainException(
            'Last name too long',
            'INVALID_USER_UPDATE',
            `Last name cannot exceed ${User.NAME_MAX_LENGTH} characters`,
          ),
        );
      }
    }

    if (firstName !== undefined) {
      this._firstName = firstName;
    }
    if (lastName !== undefined) {
      this._lastName = lastName;
    }

    this.markAsUpdated();
    return Result.ok();
  }

  public completeOnboarding(): Result<void> {
    if (this._onboardingCompleted) {
      return Result.ok(); // Already completed, no-op
    }

    this._onboardingCompleted = true;
    this._metadata.onboardingCompletedAt = new Date();
    this.markAsUpdated();
    return Result.ok();
  }

  public updateMetadata(metadata: Record<string, any>): Result<void> {
    this._metadata = { ...this._metadata, ...metadata };
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Business rule: Check if user profile is complete
   */
  public isProfileComplete(): boolean {
    return !!(this._firstName && this._lastName);
  }

  /**
   * Business rule: Check if user can access premium features
   * (This could be extended with subscription checks, etc.)
   */
  public canAccessPremiumFeatures(): boolean {
    return this._onboardingCompleted && this.isProfileComplete();
  }

  public toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this._email,
      firstName: this._firstName,
      lastName: this._lastName,
      onboardingCompleted: this._onboardingCompleted,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
