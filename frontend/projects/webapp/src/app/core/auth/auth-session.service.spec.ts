import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { type E2EWindow } from './e2e-window';
import { AuthCleanupService } from './auth-cleanup.service';
import {
  createMockSupabaseClient,
  type MockSupabaseClient,
} from '../testing/test-utils';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let mockAuthState: Partial<AuthStateService>;
  let mockConfig: Partial<ApplicationConfiguration>;
  let mockLogger: Partial<Logger>;
  let mockErrorLocalizer: Partial<AuthErrorLocalizer>;
  let mockSupabaseClient: MockSupabaseClient;
  let mockCleanup: Partial<AuthCleanupService>;
  let userGetter: () => User | null;

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

  beforeEach(async () => {
    userGetter = vi.fn<[], User | null>().mockReturnValue(null);

    mockAuthState = {
      setSession: vi.fn(),
      setLoading: vi.fn(),
      user: userGetter,
    };

    mockConfig = {
      supabaseUrl: vi.fn().mockReturnValue('https://test.supabase.co'),
      supabaseAnonKey: vi.fn().mockReturnValue('test-key'),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn().mockReturnValue('Erreur localisée'),
    };

    mockCleanup = {
      performCleanup: vi.fn(),
    };

    mockSupabaseClient = createMockSupabaseClient();

    TestBed.configureTestingModule({
      providers: [
        AuthSessionService,
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: Logger, useValue: mockLogger },
        { provide: AuthErrorLocalizer, useValue: mockErrorLocalizer },
        { provide: AuthCleanupService, useValue: mockCleanup },
      ],
    });

    service = TestBed.inject(AuthSessionService);

    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(
      mockSupabaseClient as SupabaseClient,
    );
  });

  const captureAuthStateChangeCallback = (
    client: Partial<SupabaseClient>,
  ): ((event: AuthChangeEvent, session: Session | null) => void) => {
    let capturedCallback: (
      event: AuthChangeEvent,
      session: Session | null,
    ) => void = () => undefined;
    const auth = client.auth as {
      onAuthStateChange: (
        callback: (event: AuthChangeEvent, session: Session | null) => void,
      ) => { data: { subscription: { unsubscribe: () => void } } };
    };

    vi.mocked(auth.onAuthStateChange).mockImplementation((callback) => {
      capturedCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Return a wrapper function that calls the captured callback
    return (event, session) => capturedCallback(event, session);
  };

  it('should throw error if getClient called before initialization', () => {
    expect(() => service.getClient()).toThrow(
      'Supabase client not initialized',
    );
  });

  it('should initialize Supabase client and load session', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('should update auth state on SIGNED_IN event', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    vi.mocked(mockAuthState.setSession).mockClear();
    vi.mocked(mockAuthState.setLoading).mockClear();
    vi.mocked(mockLogger.debug).mockClear();

    callback('SIGNED_IN', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'SIGNED_IN',
      session: mockSession.user.id,
    });
  });

  it('should update auth state on TOKEN_REFRESHED event', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    vi.mocked(mockAuthState.setSession).mockClear();
    vi.mocked(mockAuthState.setLoading).mockClear();
    vi.mocked(mockLogger.debug).mockClear();

    callback('TOKEN_REFRESHED', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'TOKEN_REFRESHED',
      session: mockSession.user.id,
    });
  });

  it('should update auth state and cleanup on SIGNED_OUT event', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(userGetter).mockReturnValue(mockSession.user);

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    vi.mocked(mockAuthState.setSession).mockClear();
    vi.mocked(mockAuthState.setLoading).mockClear();
    vi.mocked(mockLogger.debug).mockClear();

    callback('SIGNED_OUT', null);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).toHaveBeenCalledWith(
      mockSession.user.id,
    );
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'SIGNED_OUT',
      session: undefined,
    });
  });

  it('should update auth state on USER_UPDATED event', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    vi.mocked(mockAuthState.setSession).mockClear();
    vi.mocked(mockAuthState.setLoading).mockClear();
    vi.mocked(mockLogger.debug).mockClear();

    callback('USER_UPDATED', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'USER_UPDATED',
      session: mockSession.user.id,
    });
  });

  it('should handle session load error during initialization', async () => {
    const error = new Error('Session load failed');
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: null },
      error,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    await service.initializeAuthState();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Erreur lors de la récupération de la session:',
      error,
    );
    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
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

    expect(mockLogger.info).toHaveBeenCalledWith(
      '🎭 Mode test E2E détecté, utilisation des mocks auth',
    );
    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockSupabaseClient.auth.getSession).not.toHaveBeenCalled();

    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  });

  it('should get current session', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    const session = await service.getCurrentSession();

    expect(session).toEqual(mockSession);
  });

  it('should return null when getCurrentSession fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: new Error('Failed'),
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    const session = await service.getCurrentSession();

    expect(session).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should refresh session successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);
    vi.mocked(mockSupabaseClient.auth.refreshSession).mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    } satisfies Awaited<
      ReturnType<typeof mockSupabaseClient.auth.refreshSession>
    >);

    await service.initializeAuthState();

    const result = await service.refreshSession();

    expect(result).toBe(true);
  });

  it('should return false when refreshSession fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    vi.mocked(mockSupabaseClient.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Refresh failed'),
    } satisfies Awaited<
      ReturnType<typeof mockSupabaseClient.auth.refreshSession>
    >);

    const result = await service.refreshSession();

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should set session successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    vi.mocked(mockSupabaseClient.auth.setSession).mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.setSession>>);

    const result = await service.setSession({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockLogger.info).toHaveBeenCalledWith('Session set successfully', {
      userId: mockSession.user.id,
    });
  });

  it('should return error when setSession fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    const error: Error = { message: 'Invalid session' } as Error;
    vi.mocked(mockSupabaseClient.auth.setSession).mockResolvedValue({
      data: { session: null, user: null },
      error,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.setSession>>);

    const result = await service.setSession({
      access_token: 'invalid-token',
      refresh_token: 'invalid-refresh',
    });

    expect(result).toEqual({
      success: false,
      error: 'Erreur localisée',
    });
    expect(mockErrorLocalizer.localizeError).toHaveBeenCalledWith(
      'Invalid session',
    );
  });

  it('should handle unexpected error in setSession', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);

    await service.initializeAuthState();

    vi.mocked(mockSupabaseClient.auth.setSession).mockRejectedValue(
      new Error('Unexpected error'),
    );

    const result = await service.setSession({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error setting session:',
      expect.any(Error),
    );
  });

  it('should sign out and update state without calling cleanup directly', async () => {
    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);
    vi.mocked(mockSupabaseClient.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: {} },
    } as ReturnType<typeof mockSupabaseClient.auth.onAuthStateChange>);
    vi.mocked(mockSupabaseClient.auth.signOut).mockResolvedValue({
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.signOut>>);

    await service.initializeAuthState();

    (mockAuthState.setSession as ReturnType<typeof vi.fn>).mockClear();
    (mockAuthState.setLoading as ReturnType<typeof vi.fn>).mockClear();
    (mockCleanup.performCleanup as ReturnType<typeof vi.fn>).mockClear();

    await service.signOut();

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).not.toHaveBeenCalled();
  });

  it('should sign out in E2E mode and call cleanup directly', async () => {
    const mockE2EState = {
      user: mockSession.user,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };

    (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;
    (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = mockE2EState;

    vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } satisfies Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>);

    await service.initializeAuthState();

    (userGetter as ReturnType<typeof vi.fn>).mockReturnValue(mockSession.user);
    (mockAuthState.setSession as ReturnType<typeof vi.fn>).mockClear();
    (mockAuthState.setLoading as ReturnType<typeof vi.fn>).mockClear();
    (mockCleanup.performCleanup as ReturnType<typeof vi.fn>).mockClear();

    await service.signOut();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '🎭 Mode test E2E: Simulation du logout',
    );
    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).toHaveBeenCalledWith(
      mockSession.user.id,
    );
    expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();

    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  });
});
