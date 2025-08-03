import { Injectable } from '@nestjs/common';
import {
  AuthSession,
  AuthSessionSnapshot,
} from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';
import {
  AuthResponseDto,
  SessionResponseDto,
} from '../api/dto/auth-swagger.dto';

@Injectable()
export class AuthMapper {
  /**
   * Map AuthSession entity to API response
   */
  toAuthResponse(authSession: AuthSession): AuthResponseDto {
    const snapshot = authSession.toSnapshot();

    return {
      userId: snapshot.userId,
      email: snapshot.email,
      accessToken: snapshot.accessToken,
      refreshToken: snapshot.refreshToken,
      expiresAt: snapshot.expiresAt.toISOString(),
    };
  }

  /**
   * Map Session value object to API response
   */
  toSessionResponse(session: Session): SessionResponseDto {
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
      userId: session.userId,
    };
  }

  /**
   * Map AuthSession entity to simplified auth info
   */
  toAuthInfo(authSession: AuthSession): {
    userId: string;
    email: string;
    isValid: boolean;
    needsRefresh: boolean;
  } {
    return {
      userId: authSession.userId,
      email: authSession.email,
      isValid: authSession.isValid(),
      needsRefresh: authSession.needsRefresh(),
    };
  }
}
