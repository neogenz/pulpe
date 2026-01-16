import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { AuthOAuthService } from './auth-oauth.service';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { ApplicationConfiguration } from '../config/application-configuration';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { ROUTES } from '../routing/routes-constants';
import { type E2EWindow } from './e2e-window';
import {
  createMockSupabaseClient,
  type MockSupabaseClient,
} from '../testing/test-utils';

describe('AuthOAuthService', () => {
  let service: AuthOAuthService;
  let mockSession: Partial<AuthSessionService>;
  let mockState: Partial<AuthStateService>;
  let mockConfig: Partial<ApplicationConfiguration>;
  let mockErrorLocalizer: Partial<AuthErrorLocalizer>;
  let mockLogger: Partial<Logger>;
  let mockSupabaseClient: MockSupabaseClient;

  const sessionSignal = signal<Session | null>(null);

  beforeEach(() => {
    mockSupabaseClient = createMockSupabaseClient();

    mockSession = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockState = {
      session: sessionSignal.asReadonly(),
    };

    mockConfig = {
      baseUrl: vi.fn().mockReturnValue('https://example.com'),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn().mockReturnValue('Erreur localisée'),
    };

    mockLogger = {
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthOAuthService,
        { provide: AuthSessionService, useValue: mockSession },
        { provide: AuthStateService, useValue: mockState },
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: AuthErrorLocalizer, useValue: mockErrorLocalizer },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(AuthOAuthService);
    sessionSignal.set(null);
  });

  afterEach(() => {
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
  });

  describe('getOAuthUserMetadata', () => {
    it('should return null when no session', () => {
      const metadata = service.getOAuthUserMetadata();

      expect(metadata).toBeNull();
    });

    it('should return null when no user_metadata', () => {
      sessionSignal.set({
        user: {
          id: 'user-123',
          aud: 'authenticated',
          role: 'authenticated',
        },
      } as Session);

      const metadata = service.getOAuthUserMetadata();

      expect(metadata).toBeNull();
    });

    it('should return metadata when given_name exists', () => {
      sessionSignal.set({
        user: {
          id: 'user-123',
          aud: 'authenticated',
          role: 'authenticated',
          user_metadata: {
            given_name: 'John',
            full_name: 'John Doe',
          },
        },
      } as Session);

      const metadata = service.getOAuthUserMetadata();

      expect(metadata).toEqual({
        givenName: 'John',
        fullName: 'John Doe',
      });
    });

    it('should return null when metadata has no name fields', () => {
      sessionSignal.set({
        user: {
          id: 'user-123',
          aud: 'authenticated',
          role: 'authenticated',
          user_metadata: {
            other_field: 'value',
          },
        },
      } as Session);

      const metadata = service.getOAuthUserMetadata();

      expect(metadata).toBeNull();
    });
  });

  describe('signInWithGoogle', () => {
    it('should call Supabase OAuth with correct redirect URL', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithOAuth).mockResolvedValue({
        data: { provider: 'google', url: 'https://google.com/oauth' },
        error: null,
      } as const);

      const result = await service.signInWithGoogle();

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/${ROUTES.APP}`,
        },
      });
    });

    it('should return localized error when OAuth fails', async () => {
      const error = { message: 'OAuth failed' } as Error;
      vi.mocked(mockSupabaseClient.auth.signInWithOAuth).mockResolvedValue({
        data: { provider: 'google', url: null },
        error,
      } as const);

      const result = await service.signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: 'Erreur localisée',
      });
      expect(mockErrorLocalizer.localizeError).toHaveBeenCalledWith(
        'OAuth failed',
      );
    });

    it('should return google connection error when exception occurs', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithOAuth).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: AUTH_ERROR_MESSAGES.GOOGLE_CONNECTION_ERROR,
      });
    });

    it('should bypass Supabase in E2E mode', async () => {
      (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;

      const result = await service.signInWithGoogle();

      expect(result).toEqual({ success: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎭 Mode test E2E: Simulation du signin Google',
      );
      expect(mockSupabaseClient.auth.signInWithOAuth).not.toHaveBeenCalled();
    });
  });
});
