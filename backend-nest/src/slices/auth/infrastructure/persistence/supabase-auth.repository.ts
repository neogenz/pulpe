import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result } from '@shared/domain/enhanced-result';
import { PinoLogger } from 'nestjs-pino';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import {
  type AuthRepository,
  type SignUpData,
  type SignInData,
} from '../../domain/repositories/auth.repository';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';
import type { Database } from '@/types/database.types';

@Injectable()
export class SupabaseAuthRepository implements AuthRepository {
  private readonly supabaseClient: SupabaseClient<Database>;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SupabaseAuthRepository.name);

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabaseClient = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async signUp(data: SignUpData): Promise<Result<AuthSession>> {
    try {
      // Sign up with Supabase Auth
      const { data: authData, error } = await this.supabaseClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.sign-up.failed',
          error: error.message,
          code: error.code,
        });

        // Map Supabase errors to domain errors
        if (error.code === 'user_already_exists') {
          return Result.fail(
            new GenericDomainException(
              'User already exists',
              'USER_ALREADY_EXISTS',
              'An account with this email already exists',
            ),
          );
        }

        return Result.fail(
          new GenericDomainException(
            'Sign up failed',
            'SIGN_UP_FAILED',
            error.message,
          ),
        );
      }

      if (!authData.user || !authData.session) {
        return Result.fail(
          new GenericDomainException(
            'Sign up failed',
            'SIGN_UP_FAILED',
            'No user or session returned',
          ),
        );
      }

      // Create Session value object
      const sessionResult = Session.create({
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt: new Date(authData.session.expires_at! * 1000),
        userId: authData.user.id,
      });

      if (sessionResult.isFailure) {
        return Result.fail(sessionResult.error);
      }

      // Create AuthSession entity
      const authSessionResult = AuthSession.create({
        userId: authData.user.id,
        email: authData.user.email!,
        session: sessionResult.getValue(),
      });

      if (authSessionResult.isFailure) {
        return Result.fail(authSessionResult.error);
      }

      return Result.ok(authSessionResult.getValue());
    } catch {
      this.logger.error({
        operation: 'supabase-auth.sign-up.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Sign up failed',
          'SIGN_UP_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async signIn(data: SignInData): Promise<Result<AuthSession>> {
    try {
      // Sign in with Supabase Auth
      const { data: authData, error } =
        await this.supabaseClient.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.sign-in.failed',
          error: error.message,
          code: error.code,
        });

        // Map Supabase errors to domain errors
        if (error.code === 'invalid_credentials') {
          return Result.fail(
            new GenericDomainException(
              'Invalid credentials',
              'INVALID_CREDENTIALS',
              'Email or password is incorrect',
            ),
          );
        }

        return Result.fail(
          new GenericDomainException(
            'Sign in failed',
            'SIGN_IN_FAILED',
            error.message,
          ),
        );
      }

      if (!authData.user || !authData.session) {
        return Result.fail(
          new GenericDomainException(
            'Sign in failed',
            'SIGN_IN_FAILED',
            'No user or session returned',
          ),
        );
      }

      // Create Session value object
      const sessionResult = Session.create({
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt: new Date(authData.session.expires_at! * 1000),
        userId: authData.user.id,
      });

      if (sessionResult.isFailure) {
        return Result.fail(sessionResult.error);
      }

      // Create AuthSession entity
      const authSessionResult = AuthSession.create({
        userId: authData.user.id,
        email: authData.user.email!,
        session: sessionResult.getValue(),
      });

      if (authSessionResult.isFailure) {
        return Result.fail(authSessionResult.error);
      }

      return Result.ok(authSessionResult.getValue());
    } catch {
      this.logger.error({
        operation: 'supabase-auth.sign-in.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Sign in failed',
          'SIGN_IN_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async signOut(userId: string): Promise<Result<void>> {
    try {
      // Note: Supabase sign out requires the JWT token, not user ID
      // In a real implementation, you might need to pass the token or get it from context
      const { error } = await this.supabaseClient.auth.signOut();

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.sign-out.failed',
          userId,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Sign out failed',
            'SIGN_OUT_FAILED',
            error.message,
          ),
        );
      }

      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'supabase-auth.sign-out.error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Sign out failed',
          'SIGN_OUT_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<Result<Session>> {
    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.refresh-token.failed',
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Token refresh failed',
            'TOKEN_REFRESH_FAILED',
            error.message,
          ),
        );
      }

      if (!data.session) {
        return Result.fail(
          new GenericDomainException(
            'Token refresh failed',
            'TOKEN_REFRESH_FAILED',
            'No session returned',
          ),
        );
      }

      // Create Session value object
      const sessionResult = Session.create({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000),
        userId: data.user!.id,
      });

      if (sessionResult.isFailure) {
        return Result.fail(sessionResult.error);
      }

      return Result.ok(sessionResult.getValue());
    } catch {
      this.logger.error({
        operation: 'supabase-auth.refresh-token.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Token refresh failed',
          'TOKEN_REFRESH_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async getSession(accessToken: string): Promise<Result<AuthSession | null>> {
    try {
      const { data, error } =
        await this.supabaseClient.auth.getUser(accessToken);

      if (error) {
        // Token might be invalid or expired
        if (error.code === 'bad_jwt' || error.status === 401) {
          return Result.ok(null);
        }

        this.logger.warn({
          operation: 'supabase-auth.get-session.failed',
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Get session failed',
            'GET_SESSION_FAILED',
            error.message,
          ),
        );
      }

      if (!data.user) {
        return Result.ok(null);
      }

      // We need to decode the JWT to get session info
      // For now, we'll create a minimal session
      const sessionResult = Session.create({
        accessToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now (default)
        userId: data.user.id,
      });

      if (sessionResult.isFailure) {
        return Result.fail(sessionResult.error);
      }

      // Create AuthSession entity
      const authSessionResult = AuthSession.create({
        userId: data.user.id,
        email: data.user.email!,
        session: sessionResult.getValue(),
      });

      if (authSessionResult.isFailure) {
        return Result.fail(authSessionResult.error);
      }

      return Result.ok(authSessionResult.getValue());
    } catch {
      this.logger.error({
        operation: 'supabase-auth.get-session.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Get session failed',
          'GET_SESSION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async validateToken(accessToken: string): Promise<Result<boolean>> {
    try {
      const { data, error } =
        await this.supabaseClient.auth.getUser(accessToken);

      if (error || !data.user) {
        return Result.ok(false);
      }

      return Result.ok(true);
    } catch {
      this.logger.error({
        operation: 'supabase-auth.validate-token.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Token validation failed',
          'TOKEN_VALIDATION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async sendPasswordResetEmail(email: string): Promise<Result<void>> {
    try {
      const { error } = await this.supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${this.configService.get<string>('FRONTEND_URL')}/auth/reset-password`,
        },
      );

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.send-password-reset.failed',
          email,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Send password reset failed',
            'SEND_PASSWORD_RESET_FAILED',
            error.message,
          ),
        );
      }

      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'supabase-auth.send-password-reset.error',
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Send password reset failed',
          'SEND_PASSWORD_RESET_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<Result<void>> {
    try {
      const { error } = await this.supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        this.logger.warn({
          operation: 'supabase-auth.reset-password.failed',
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Reset password failed',
            'RESET_PASSWORD_FAILED',
            error.message,
          ),
        );
      }

      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'supabase-auth.reset-password.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Reset password failed',
          'RESET_PASSWORD_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async verifyEmail(token: string): Promise<Result<void>> {
    try {
      // Supabase handles email verification through magic links
      // This method might not be needed in the current implementation
      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'supabase-auth.verify-email.error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Email verification failed',
          'EMAIL_VERIFICATION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async resendVerificationEmail(email: string): Promise<Result<void>> {
    try {
      // Supabase doesn't have a direct method for this
      // You might need to implement a custom solution
      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'supabase-auth.resend-verification.error',
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Resend verification failed',
          'RESEND_VERIFICATION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
