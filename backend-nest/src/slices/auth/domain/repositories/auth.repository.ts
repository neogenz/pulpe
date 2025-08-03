import { Result } from '@shared/domain/enhanced-result';
import { AuthSession } from '../entities/auth-session.entity';
import { Session } from '../value-objects/session.value-object';

export const AUTH_REPOSITORY_TOKEN = 'AuthRepository';

export interface SignUpData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthRepository {
  /**
   * Sign up a new user
   */
  signUp(data: SignUpData): Promise<Result<AuthSession>>;

  /**
   * Sign in an existing user
   */
  signIn(data: SignInData): Promise<Result<AuthSession>>;

  /**
   * Sign out the current user
   */
  signOut(userId: string): Promise<Result<void>>;

  /**
   * Refresh the authentication token
   */
  refreshToken(refreshToken: string): Promise<Result<Session>>;

  /**
   * Get the current session
   */
  getSession(accessToken: string): Promise<Result<AuthSession | null>>;

  /**
   * Validate a token
   */
  validateToken(accessToken: string): Promise<Result<boolean>>;

  /**
   * Send password reset email
   */
  sendPasswordResetEmail(email: string): Promise<Result<void>>;

  /**
   * Reset password with token
   */
  resetPassword(token: string, newPassword: string): Promise<Result<void>>;

  /**
   * Verify email with token
   */
  verifyEmail(token: string): Promise<Result<void>>;

  /**
   * Resend verification email
   */
  resendVerificationEmail(email: string): Promise<Result<void>>;
}
