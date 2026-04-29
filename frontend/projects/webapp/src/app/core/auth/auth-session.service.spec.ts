import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { SCHEDULED_DELETION_PARAMS } from './auth-constants';
import { type E2EWindow } from './e2e-window';
import { AuthCleanupService } from './auth-cleanup.service';
import { ROUTES } from '@core/routing/routes-constants';
import {
  createMockSupabaseClient,
  type MockSupabaseClient,
} from '../testing/test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const buildJwt = (payload: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let mockAuthState: {
    applyState: Mock;
    user: () => User | null;
  };
  let mockConfig: Partial<ApplicationConfiguration>;
  let mockLogger: {
    info: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  let mockErrorLocalizer: {
    localizeError: Mock;
    localizeAuthError: Mock;
  };
  let mockSupabaseClient: MockSupabaseClient;
  let mockCleanup: { performCleanup: Mock };
  let mockRouter: { navigate: Mock };
  let mockUserSignal: ReturnType<typeof signal<User | null>>;

  const mockSession: Session = {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-123',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };

  beforeEach(() => {
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;

    mockUserSignal = signal<User | null>(null);

    mockAuthState = {
      applyState: vi.fn(),
      user: mockUserSignal.asReadonly(),
    };

    mockConfig = {
      supabaseUrl: signal('https://test.supabase.co'),
      supabaseAnonKey: signal('test-key'),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn().mockReturnValue('Erreur localisée'),
      localizeAuthError: vi.fn().mockReturnValue('Erreur localisée'),
    };

    mockCleanup = { performCleanup: vi.fn() };
    mockRouter = { navigate: vi.fn() };
    mockSupabaseClient = createMockSupabaseClient();
    createClientMock.mockReturnValue(mockSupabaseClient);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        AuthSessionService,
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: Logger, useValue: mockLogger },
        { provide: AuthErrorLocalizer, useValue: mockErrorLocalizer },
        { provide: AuthCleanupService, useValue: mockCleanup },
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
    vi.clearAllMocks();
  });

  const captureAuthStateChangeCallback = (
    client: MockSupabaseClient,
  ): ((event: AuthChangeEvent, session: Session | null) => void) => {
    let captured: (
      event: AuthChangeEvent,
      session: Session | null,
    ) => void = () => undefined;
    client.auth.onAuthStateChange.mockImplementation(
      (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        captured = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );
    return (event, session) => captured(event, session);
  };

  it('should throw error if getClient called before initialization', () => {
    expect(() => service.getClient()).toThrow(
      'Supabase client not initialized',
    );
  });

  it('should initialize Supabase client and load session', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'authenticated',
      session: mockSession,
    });
    expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('should not reinitialize if already initialized', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    mockAuthState.applyState.mockClear();
    mockSupabaseClient.auth.onAuthStateChange.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    await service.initializeAuthState();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Auth already initialized, skipping',
    );
    expect(mockAuthState.applyState).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('should sign out and navigate to login with scheduled-deletion params on SIGNED_IN with scheduledDeletionAt', async () => {
    const deletionDate = '2026-02-26T00:00:00Z';
    const sessionWithDeletion: Session = {
      ...mockSession,
      user: {
        ...mockSession.user,
        user_metadata: { scheduledDeletionAt: deletionDate },
      },
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    callback('SIGNED_IN', sessionWithDeletion);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'User account scheduled for deletion detected, signing out',
      { userId: sessionWithDeletion.user.id },
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/', ROUTES.LOGIN], {
      queryParams: {
        [SCHEDULED_DELETION_PARAMS.REASON]:
          SCHEDULED_DELETION_PARAMS.REASON_VALUE,
        [SCHEDULED_DELETION_PARAMS.DATE]: deletionDate,
      },
    });
  });

  it('should update auth state on SIGNED_IN event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();
    mockAuthState.applyState.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('SIGNED_IN', mockSession);

    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'authenticated',
      session: mockSession,
    });
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'SIGNED_IN',
      session: mockSession.user.id,
    });
  });

  it('should update auth state on TOKEN_REFRESHED event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();
    mockAuthState.applyState.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('TOKEN_REFRESHED', mockSession);

    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'authenticated',
      session: mockSession,
    });
  });

  it('should update auth state and cleanup on SIGNED_OUT event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockUserSignal.set(mockSession.user);
    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();
    mockAuthState.applyState.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('SIGNED_OUT', null);

    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'unauthenticated',
    });
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
  });

  it('should update auth state on USER_UPDATED event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();
    mockAuthState.applyState.mockClear();

    callback('USER_UPDATED', mockSession);

    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'authenticated',
      session: mockSession,
    });
  });

  describe('refresh deduplication', () => {
    it('should deduplicate concurrent refreshSession calls', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      await service.initializeAuthState();

      const [r1, r2, r3] = await Promise.all([
        service.refreshSession(),
        service.refreshSession(),
        service.refreshSession(),
      ]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle session load error during initialization', async () => {
    const error = new Error('Session load failed');
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error,
    });

    await service.initializeAuthState();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Erreur lors de la récupération de la session:',
      error,
    );
    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'unauthenticated',
    });
  });

  it('should handle E2E bypass mode', async () => {
    const mockE2EState = {
      user: mockSession.user,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };

    (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;
    (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = mockE2EState;

    await service.initializeAuthState();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '🎭 Mode test E2E détecté, utilisation des mocks auth',
    );
    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'authenticated',
      session: mockSession,
    });
    expect(mockSupabaseClient.auth.getSession).not.toHaveBeenCalled();
  });

  it('should refresh session successfully', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseClient.auth.refreshSession.mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });

    await service.initializeAuthState();

    const result = await service.refreshSession();

    expect(result).toBe(true);
  });

  it('should return false when refreshSession fails', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    mockSupabaseClient.auth.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Refresh failed'),
    });

    const result = await service.refreshSession();

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  describe('setSession', () => {
    const validJwt = buildJwt({
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    beforeEach(async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });
      await service.initializeAuthState();
      mockAuthState.applyState.mockClear();
    });

    it('should set session successfully with valid JWT', async () => {
      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const result = await service.setSession({
        access_token: validJwt,
        refresh_token: 'test-refresh',
      });

      expect(result).toEqual({ success: true });
      expect(mockAuthState.applyState).toHaveBeenCalledWith({
        phase: 'authenticated',
        session: mockSession,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Applying session', {
        userId: 'user-123',
      });
    });

    it('should reject malformed access token without calling Supabase', async () => {
      const result = await service.setSession({
        access_token: 'not-a-jwt',
        refresh_token: 'test-refresh',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockSupabaseClient.auth.setSession).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'setSession rejected: malformed access token',
      );
    });

    it('should reject expired access token without calling Supabase', async () => {
      const expiredJwt = buildJwt({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      const result = await service.setSession({
        access_token: expiredJwt,
        refresh_token: 'test-refresh',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockSupabaseClient.auth.setSession).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'setSession rejected: access token expired',
      );
    });

    it('should return localized error when Supabase setSession fails', async () => {
      const error: Error = { message: 'Invalid session' } as Error;
      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: { session: null, user: null },
        error,
      });

      const result = await service.setSession({
        access_token: validJwt,
        refresh_token: 'test-refresh',
      });

      expect(result).toEqual({
        success: false,
        error: 'Erreur localisée',
      });
      expect(mockErrorLocalizer.localizeAuthError).toHaveBeenCalledWith(error);
    });

    it('should handle unexpected error in setSession', async () => {
      mockSupabaseClient.auth.setSession.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const result = await service.setSession({
        access_token: validJwt,
        refresh_token: 'test-refresh',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error setting session:',
        expect.any(Error),
      );
    });
  });

  it('should sign out and update state with explicit cleanup', async () => {
    mockUserSignal.set(mockSession.user);
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

    await service.initializeAuthState();
    mockAuthState.applyState.mockClear();
    mockCleanup.performCleanup.mockClear();

    await service.signOut();

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'unauthenticated',
    });
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
  });

  it('should sign out in E2E mode and apply unauthenticated state', async () => {
    const mockE2EState = {
      user: mockSession.user,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };

    (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;
    (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = mockE2EState;

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    await service.initializeAuthState();
    mockUserSignal.set(mockSession.user);
    mockAuthState.applyState.mockClear();
    mockCleanup.performCleanup.mockClear();
    mockLogger.info.mockClear();

    await service.signOut();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '🎭 Mode test E2E: Simulation du logout',
    );
    expect(mockAuthState.applyState).toHaveBeenCalledWith({
      phase: 'unauthenticated',
    });
    expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
  });

  it('should cleanup auth subscription via DestroyRef on destruction', async () => {
    const unsubscribeMock = vi.fn();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    await service.initializeAuthState();

    TestBed.resetTestingModule();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should prevent concurrent initialization race condition', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const [, ,] = await Promise.all([
      service.initializeAuthState(),
      service.initializeAuthState(),
      service.initializeAuthState(),
    ]);

    expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  describe('verifyPassword', () => {
    beforeEach(async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });
      await service.initializeAuthState();
      mockUserSignal.set(mockSession.user);
    });

    it('should verify password successfully', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const result = await service.verifyPassword('correct-password');

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'correct-password',
      });
    });

    it('should return error when password is incorrect', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Invalid login credentials'),
      });

      const result = await service.verifyPassword('wrong-password');

      expect(result).toEqual({
        success: false,
        error: 'Erreur localisée',
      });
    });

    it('should return error when user is not connected', async () => {
      mockUserSignal.set(null);

      const result = await service.verifyPassword('some-password');

      expect(result).toEqual({
        success: false,
        error: 'Utilisateur non connecté',
      });
      expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });
});
