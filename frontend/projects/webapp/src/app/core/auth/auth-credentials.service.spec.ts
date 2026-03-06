import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Session, User } from '@supabase/supabase-js';
import { ClientKeyService } from '@core/encryption';
import { AuthCredentialsService } from './auth-credentials.service';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { type E2EWindow } from './e2e-window';
import {
  createMockSupabaseClient,
  type AuthSessionResult,
  type MockSupabaseClient,
} from '../testing/test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

describe('AuthCredentialsService', () => {
  let service: AuthCredentialsService;
  let mockSession: Partial<AuthSessionService>;
  let mockState: Partial<AuthStateService>;
  let mockErrorLocalizer: Partial<AuthErrorLocalizer>;
  let mockLogger: Partial<Logger>;
  let mockClientKeyService: Partial<ClientKeyService>;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = createMockSupabaseClient();

    mockSession = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    mockState = {
      setSession: vi.fn(),
      setLoading: vi.fn(),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn().mockReturnValue('Erreur localisée'),
      localizeAuthError: vi.fn().mockReturnValue('Erreur localisée'),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockClientKeyService = {
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
        AuthCredentialsService,
        { provide: AuthSessionService, useValue: mockSession },
        { provide: AuthStateService, useValue: mockState },
        { provide: AuthErrorLocalizer, useValue: mockErrorLocalizer },
        { provide: Logger, useValue: mockLogger },
        { provide: ClientKeyService, useValue: mockClientKeyService },
      ],
    });

    service = TestBed.inject(AuthCredentialsService);
  });

  afterEach(() => {
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
  });

  describe('signInWithEmail', () => {
    it('should return success when sign in succeeds', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockResolvedValue({
        data: { user: {} as User, session: {} as Session },
        error: null,
      } satisfies AuthSessionResult);

      const result = await service.signInWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should return localized error when sign in fails', async () => {
      const error = { message: 'Invalid credentials' } as Error;
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error,
      } satisfies AuthSessionResult);

      const result = await service.signInWithEmail('test@example.com', 'wrong');

      expect(result).toEqual({
        success: false,
        error: 'Erreur localisée',
      });
      expect(mockErrorLocalizer.localizeAuthError).toHaveBeenCalledWith(error);
    });

    it('should return unexpected error when exception occurs', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.signInWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({
        success: false,
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_LOGIN_ERROR,
      });
    });

    it('should return harmonized message with Swiss date format when account is scheduled for deletion', async () => {
      const deletionDate = '2026-02-26T00:00:00Z';
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            user_metadata: { scheduledDeletionAt: deletionDate },
          } as unknown as User,
          session: {
            user: {
              id: 'user-123',
              user_metadata: { scheduledDeletionAt: deletionDate },
            },
          } as unknown as Session,
        },
        error: null,
      } satisfies AuthSessionResult);

      const result = await service.signInWithEmail(
        'test@example.com',
        'password',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Ton compte est programmé pour suppression le 26.02.2026. Si c'est une erreur, contacte le support.",
      );
    });

    it('should bypass Supabase in E2E mode', async () => {
      (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;

      const result = await service.signInWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({ success: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎭 Mode test E2E: Simulation du signin',
      );
      expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('signUpWithEmail', () => {
    it('should return success when sign up succeeds', async () => {
      vi.mocked(mockSupabaseClient.auth.signUp).mockResolvedValue({
        data: { user: {} as User, session: {} as Session },
        error: null,
      } satisfies AuthSessionResult);

      const result = await service.signUpWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should return localized error when sign up fails', async () => {
      const error = { message: 'Email already registered' } as Error;
      vi.mocked(mockSupabaseClient.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error,
      } satisfies AuthSessionResult);

      const result = await service.signUpWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({
        success: false,
        error: 'Erreur localisée',
      });
      expect(mockErrorLocalizer.localizeAuthError).toHaveBeenCalledWith(error);
    });

    it('should return unexpected error when exception occurs', async () => {
      vi.mocked(mockSupabaseClient.auth.signUp).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.signUpWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({
        success: false,
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_SIGNUP_ERROR,
      });
    });

    it('should bypass Supabase in E2E mode', async () => {
      (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;

      const result = await service.signUpWithEmail(
        'test@example.com',
        'password',
      );

      expect(result).toEqual({ success: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎭 Mode test E2E: Simulation du signup',
      );
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    });
  });
});
