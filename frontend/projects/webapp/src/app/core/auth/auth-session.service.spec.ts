/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  beforeEach(async () => {
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
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockErrorLocalizer = {
      localizeError: vi.fn()!.mockReturnValue('Erreur localisée'),
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
    (createClient as any).mockReturnValue(
      mockSupabaseClient as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );
  });

  const captureAuthStateChangeCallback = (
    client: any,
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

    (auth.onAuthStateChange as any).mockImplementation(
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    expect(mockAuthState.setSession).toHaveBeenCalledWith(mockSession);
    expect(mockAuthState.setLoading).toHaveBeenCalledWith(false);
    expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('should not reinitialize if already initialized', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
    (mockSupabaseClient.auth.onAuthStateChange as any).mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

    await service.initializeAuthState();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Auth already initialized, skipping',
    );
    expect(mockAuthState.setLoading).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('should update auth state on SIGNED_IN event', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockUserSignal.set(mockSession.user);

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const callback = captureAuthStateChangeCallback(mockSupabaseClient);

    await service.initializeAuthState();

    // Clear mocks after initialization
    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
    vi.mocked(mockLogger.debug)!.mockClear();

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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    const session = await service.getCurrentSession();

    expect(session).toEqual(mockSession);
  });

  it('should return null when getCurrentSession fails', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: null },
      error: new Error('Failed'),
    });

    const session = await service.getCurrentSession();

    expect(session).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should refresh session successfully', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );
    (mockSupabaseClient.auth.refreshSession as any).mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });

    await service.initializeAuthState();

    const result = await service.refreshSession();

    expect(result).toBe(true);
  });

  it('should return false when refreshSession fails', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    (mockSupabaseClient.auth.refreshSession as any).mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Refresh failed'),
    });

    const result = await service.refreshSession();

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should set session successfully', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    (mockSupabaseClient.auth.setSession as any).mockResolvedValue({
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    const error: Error = { message: 'Invalid session' } as Error;
    (mockSupabaseClient.auth.setSession as any).mockResolvedValue({
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
    expect(mockErrorLocalizer.localizeError).toHaveBeenCalledWith(
      'Invalid session',
    );
  });

  it('should handle unexpected error in setSession', async () => {
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );

    await service.initializeAuthState();

    (mockSupabaseClient.auth.setSession as any).mockRejectedValue(
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
    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabaseClient.auth.onAuthStateChange as any).mockReturnValue(
      {
        data: { subscription: {} },
      } as any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    );
    (mockSupabaseClient.auth.signOut as any).mockResolvedValue({
      error: null,
    });

    await service.initializeAuthState();

    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
    (mockCleanup.performCleanup as any).mockClear();

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

    (mockSupabaseClient.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    await service.initializeAuthState();

    mockUserSignal.set(mockSession.user);
    (mockAuthState.setSession as any).mockClear();
    (mockAuthState.setLoading as any).mockClear();
    (mockCleanup.performCleanup as any).mockClear();

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
