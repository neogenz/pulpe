import { Injectable } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';
import {
  AuthRepository,
  SignUpData,
  SignInData,
} from '../../domain/repositories/auth.repository';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

interface UserData {
  id: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class MockAuthRepository implements AuthRepository {
  private users = new Map<string, UserData>();
  private sessions = new Map<string, AuthSession>();
  private refreshTokens = new Map<string, string>(); // refreshToken -> userId

  async signUp(data: SignUpData): Promise<Result<AuthSession>> {
    // Check if user already exists
    const existingUser = Array.from(this.users.values()).find(
      (u) => u.email === data.email,
    );
    if (existingUser) {
      return Result.fail(
        new GenericDomainException(
          'User already exists',
          'USER_ALREADY_EXISTS',
          'An account with this email already exists',
        ),
      );
    }

    // Create user
    const userId = `user-${Date.now()}`;
    const userData: UserData = {
      id: userId,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    };

    this.users.set(userId, userData);

    // Create session
    const accessToken = `access-${userId}-${Date.now()}`;
    const refreshToken = `refresh-${userId}-${Date.now()}`;
    const sessionResult = Session.create({
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      userId,
    });

    if (sessionResult.isFailure) {
      return Result.fail(
        new GenericDomainException(
          'Session creation failed',
          'SESSION_CREATION_FAILED',
          sessionResult.error?.message || 'Failed to create session',
        ),
      );
    }

    const authSessionResult = AuthSession.create({
      userId,
      email: data.email,
      session: sessionResult.value,
    });

    if (authSessionResult.isFailure) {
      return Result.fail(
        new GenericDomainException(
          'Auth session creation failed',
          'AUTH_SESSION_CREATION_FAILED',
          authSessionResult.error?.message || 'Failed to create auth session',
        ),
      );
    }

    const authSession = authSessionResult.value;
    this.sessions.set(accessToken, authSession);
    this.refreshTokens.set(refreshToken, userId);

    return Result.ok(authSession);
  }

  async signIn(data: SignInData): Promise<Result<AuthSession>> {
    const userEntry = Array.from(this.users.entries()).find(
      ([_, u]) => u.email === data.email,
    );

    if (!userEntry || userEntry[1].password !== data.password) {
      return Result.fail(
        new GenericDomainException(
          'Invalid credentials',
          'INVALID_CREDENTIALS',
          'The email or password you entered is incorrect',
        ),
      );
    }

    const [userId, userInfo] = userEntry;

    // Create new session
    const accessToken = `access-${userId}-${Date.now()}`;
    const refreshToken = `refresh-${userId}-${Date.now()}`;
    const sessionResult = Session.create({
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      userId,
    });

    if (sessionResult.isFailure) {
      return Result.fail(
        new GenericDomainException(
          'Session creation failed',
          'SESSION_CREATION_FAILED',
          sessionResult.error?.message || 'Failed to create session',
        ),
      );
    }

    const authSessionResult = AuthSession.create({
      userId,
      email: userInfo.email,
      session: sessionResult.value,
    });

    if (authSessionResult.isFailure) {
      return Result.fail(
        new GenericDomainException(
          'Auth session creation failed',
          'AUTH_SESSION_CREATION_FAILED',
          authSessionResult.error?.message || 'Failed to create auth session',
        ),
      );
    }

    const authSession = authSessionResult.value;
    this.sessions.set(accessToken, authSession);
    this.refreshTokens.set(refreshToken, userId);

    return Result.ok(authSession);
  }

  async signOut(userId: string): Promise<Result<void>> {
    // Remove all sessions for this user
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
      }
    }

    // Remove all refresh tokens for this user
    for (const [refreshToken, uid] of this.refreshTokens.entries()) {
      if (uid === userId) {
        this.refreshTokens.delete(refreshToken);
      }
    }

    return Result.ok();
  }

  async refreshToken(refreshToken: string): Promise<Result<Session>> {
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) {
      return Result.fail(
        new GenericDomainException(
          'Invalid refresh token',
          'TOKEN_REFRESH_FAILED',
          'The refresh token is invalid or expired',
        ),
      );
    }

    const userEntry = this.users.get(userId);
    if (!userEntry) {
      return Result.fail(
        new GenericDomainException(
          'User not found',
          'USER_NOT_FOUND',
          'User associated with this token was not found',
        ),
      );
    }

    // Create new session
    const newAccessToken = `access-${userId}-${Date.now()}`;
    const newRefreshToken = `refresh-${userId}-${Date.now()}`;
    const sessionResult = Session.create({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      userId,
    });

    if (sessionResult.isFailure) {
      return Result.fail(
        new GenericDomainException(
          'Session creation failed',
          'SESSION_CREATION_FAILED',
          sessionResult.error?.message || 'Failed to create session',
        ),
      );
    }

    const session = sessionResult.value;

    // Remove old refresh token
    this.refreshTokens.delete(refreshToken);
    this.refreshTokens.set(newRefreshToken, userId);

    // Create auth session for storage
    const authSessionResult = AuthSession.create({
      userId,
      email: userEntry.email,
      session,
    });

    if (authSessionResult.isSuccess) {
      this.sessions.set(newAccessToken, authSessionResult.value);
    }

    return Result.ok(session);
  }

  async getSession(accessToken: string): Promise<Result<AuthSession | null>> {
    const session = this.sessions.get(accessToken);
    if (!session) {
      return Result.ok(null);
    }

    // Check if session is expired
    if (session.session.props.expiresAt < new Date()) {
      this.sessions.delete(accessToken);
      return Result.ok(null);
    }

    return Result.ok(session);
  }

  async validateToken(accessToken: string): Promise<Result<boolean>> {
    const session = this.sessions.get(accessToken);
    if (!session) {
      return Result.ok(false);
    }

    // Check if session is expired
    if (session.session.props.expiresAt < new Date()) {
      this.sessions.delete(accessToken);
      return Result.ok(false);
    }

    return Result.ok(true);
  }

  async sendPasswordResetEmail(email: string): Promise<Result<void>> {
    const userExists = Array.from(this.users.values()).some(
      (u) => u.email === email,
    );
    if (!userExists) {
      // Don't reveal if user exists
      return Result.ok();
    }
    return Result.ok();
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<Result<void>> {
    // In a real implementation, this would validate the token
    return Result.ok();
  }

  async verifyEmail(token: string): Promise<Result<void>> {
    // In a real implementation, this would verify the email
    return Result.ok();
  }

  async resendVerificationEmail(email: string): Promise<Result<void>> {
    const userExists = Array.from(this.users.values()).some(
      (u) => u.email === email,
    );
    if (!userExists) {
      // Don't reveal if user exists
      return Result.ok();
    }
    return Result.ok();
  }
}
