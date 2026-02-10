import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { Session, User } from '@supabase/supabase-js';
import { of } from 'rxjs';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
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

describe('AuthCredentialsService', () => {
  let service: AuthCredentialsService;
  let mockSession: Partial<AuthSessionService>;
  let mockState: Partial<AuthStateService>;
  let mockErrorLocalizer: Partial<AuthErrorLocalizer>;
  let mockLogger: Partial<Logger>;
  let mockClientKeyService: Partial<ClientKeyService>;
  let mockEncryptionApi: Partial<EncryptionApi>;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = createMockSupabaseClient();

    mockSession = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockState = {
      setSession: vi.fn(),
      setLoading: vi.fn(),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn().mockReturnValue('Erreur localisée'),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    mockClientKeyService = {
      deriveAndStore: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
    };

    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'abcd1234', kdfIterations: 600000 })),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthCredentialsService,
        { provide: AuthSessionService, useValue: mockSession },
        { provide: AuthStateService, useValue: mockState },
        { provide: AuthErrorLocalizer, useValue: mockErrorLocalizer },
        { provide: Logger, useValue: mockLogger },
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
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
      expect(mockErrorLocalizer.localizeError).toHaveBeenCalledWith(
        'Invalid credentials',
      );
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

    it('should derive and store legacy client key in session storage for users without vault code', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: {} as User,
          session: {
            user: {
              user_metadata: { vaultCodeConfigured: false },
            } as unknown as User,
          } as Session,
        },
        error: null,
      } satisfies AuthSessionResult);

      const result = await service.signInWithEmail(
        'legacy@example.com',
        'legacy-password',
      );

      expect(result).toEqual({ success: true });
      expect(mockEncryptionApi.getSalt$).toHaveBeenCalled();
      expect(mockClientKeyService.deriveAndStore).toHaveBeenCalledWith(
        'legacy-password',
        'abcd1234',
        600000,
        false,
      );
    });

    it('should not derive legacy client key for users with vault code configured', async () => {
      vi.mocked(mockSupabaseClient.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: {} as User,
          session: {
            user: {
              user_metadata: { vaultCodeConfigured: true },
            } as unknown as User,
          } as Session,
        },
        error: null,
      } satisfies AuthSessionResult);

      const result = await service.signInWithEmail(
        'vault@example.com',
        'vault-password',
      );

      expect(result).toEqual({ success: true });
      expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
      expect(mockClientKeyService.deriveAndStore).not.toHaveBeenCalled();
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
      expect(mockErrorLocalizer.localizeError).toHaveBeenCalledWith(
        'Email already registered',
      );
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
