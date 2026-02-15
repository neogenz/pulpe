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
import { signal } from '@angular/core';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
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

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let mockAuthState: {
    setSession: Mock;
    setLoading: Mock;
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
  let mockCleanup: {
    performCleanup: Mock;
  };
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
    // Clean up E2E window properties before each test
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;

    mockUserSignal = signal<User | null>(null);

    mockAuthState = {
      setSession: vi.fn(),
      setLoading: vi.fn(),
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

    mockCleanup = {
      performCleanup: vi.fn(),
    };

    mockSupabaseClient = createMockSupabaseClient();

    // Configure the mock BEFORE creating the service
    createClientMock.mockReturnValue(mockSupabaseClient);

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
  });

  afterEach(() => {
    // Always clean up E2E window properties after each test
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
    vi.clearAllMocks();
  });

  const captureAuthStateChangeCallback = (
    client: MockSupabaseClient,
  ): ((event: AuthChangeEvent, session: Session | null) => void) => {
    let capturedCallback: (
      event: AuthChangeEvent,
      session: Session | null,
    ) => void = () => undefined;
    client.auth.onAuthStateChange.mockImplementation(
      (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        capturedCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    // Return a wrapper function that calls the captured callback
    return (event, session) => capturedCallback(event, session);
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

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
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

    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    mockSupabaseClient.auth.onAuthStateChange.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    await service.initializeAuthState();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Auth already initialized, skipping',
    );
    expect(mockAuthState.setLoading).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('should update auth state on SIGNED_IN event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('SIGNED_IN', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
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

    // Clear mocks after initialization
    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('TOKEN_REFRESHED', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'TOKEN_REFRESHED',
      session: mockSession.user.id,
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

    // Clear mocks after initialization
    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('SIGNED_OUT', null);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'SIGNED_OUT',
      session: undefined,
    });
  });

  it('should update auth state on USER_UPDATED event', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    callback('USER_UPDATED', mockSession);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('Auth event:', {
      event: 'USER_UPDATED',
      session: mockSession.user.id,
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

      const [result1, result2, result3] = await Promise.all([
        service.refreshSession(),
        service.refreshSession(),
        service.refreshSession(),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
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

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '🎭 Mode test E2E détecté, utilisation des mocks auth',
    );
    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockSupabaseClient.auth.getSession).not.toHaveBeenCalled();
    // Cleanup handled by afterEach
  });

  it('should get current session', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    const session = await service.getCurrentSession();

    expect(session).toEqual(mockSession);
  });

  it('should return null when getCurrentSession fails', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Failed'),
    });

    const session = await service.getCurrentSession();

    expect(session).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
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

  it('should set session successfully', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    mockSupabaseClient.auth.setSession.mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });

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
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    const error: Error = { message: 'Invalid session' } as Error;
    mockSupabaseClient.auth.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error,
    });

    const result = await service.setSession({
      access_token: 'invalid-token',
      refresh_token: 'invalid-refresh',
    });

    expect(result).toEqual({
      success: false,
      error: 'Erreur localisée',
    });
    expect(mockErrorLocalizer.localizeAuthError).toHaveBeenCalledWith(error);
  });

  it('should handle unexpected error in setSession', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    mockSupabaseClient.auth.setSession.mockRejectedValue(
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
      expect.objectContaining({
        error: expect.any(Error),
        errorType: 'Error',
        message: 'Unexpected error',
      }),
    );
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
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null,
    });

    await service.initializeAuthState();

    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    mockCleanup.performCleanup.mockClear();

    await service.signOut();

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
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

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    await service.initializeAuthState();

    mockUserSignal.set(mockSession.user);
    mockAuthState.setSession.mockClear();
    mockAuthState.setLoading.mockClear();
    mockCleanup.performCleanup.mockClear();
    mockLogger.info.mockClear();

    await service.signOut();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '🎭 Mode test E2E: Simulation du logout',
    );
    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockCleanup.performCleanup).toHaveBeenCalled();
    expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    // Cleanup handled by afterEach
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

  it('should handle SSR environment safely (window undefined)', async () => {
    const originalWindow = globalThis.window;

    try {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });

      await service.initializeAuthState();

      expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
      expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    }
  });

  it('should prevent concurrent initialization race condition', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const promise1 = service.initializeAuthState();
    const promise2 = service.initializeAuthState();
    const promise3 = service.initializeAuthState();

    await Promise.all([promise1, promise2, promise3]);

    expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Auth already initialized, skipping',
    );
  });

  it('should verify password successfully', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });

    mockUserSignal.set(mockSession.user);

    await service.initializeAuthState();

    const result = await service.verifyPassword('correct-password');

    expect(result).toEqual({ success: true });
    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'correct-password',
    });
  });

  it('should return error when password is incorrect', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Invalid login credentials'),
    });

    mockUserSignal.set(mockSession.user);

    await service.initializeAuthState();

    const result = await service.verifyPassword('wrong-password');

    expect(result).toEqual({
      success: false,
      error: 'Erreur localisée',
    });
    expect(mockErrorLocalizer.localizeAuthError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid login credentials' }),
    );
  });

  it('should return error when user is not connected', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await service.initializeAuthState();

    const result = await service.verifyPassword('some-password');

    expect(result).toEqual({
      success: false,
      error: 'Utilisateur non connecté',
    });
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
