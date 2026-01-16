import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { AuthApi } from './auth-api';
import { AuthStateService } from './auth-state.service';
import { AuthSessionService } from './auth-session.service';
import { AuthCredentialsService } from './auth-credentials.service';
import { AuthOAuthService } from './auth-oauth.service';
import { AuthCleanupService } from './auth-cleanup.service';
import type { Session } from '@supabase/supabase-js';

describe('AuthApi Facade', () => {
  let service: AuthApi;
  let mockState: Partial<AuthStateService>;
  let mockSession: Partial<AuthSessionService>;
  let mockCredentials: Partial<AuthCredentialsService>;
  let mockOAuth: Partial<AuthOAuthService>;
  let mockCleanup: Partial<AuthCleanupService>;

  const sessionSignal = signal<Session | null>(null);
  const isLoadingSignal = signal(false);
  const userSignal = signal(null);
  const isAuthenticatedSignal = signal(false);
  const authStateSignal = signal({
    session: null,
    user: null,
    isLoading: false,
    isAuthenticated: false,
  });

  beforeEach(() => {
    mockState = {
      session: sessionSignal.asReadonly(),
      isLoading: isLoadingSignal.asReadonly(),
      user: userSignal.asReadonly(),
      isAuthenticated: isAuthenticatedSignal.asReadonly(),
      authState: authStateSignal.asReadonly(),
    };

    mockSession = {
      initializeAuthState: vi.fn(),
      getCurrentSession: vi.fn(),
      refreshSession: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    };

    mockCredentials = {
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
    };

    mockOAuth = {
      getOAuthUserMetadata: vi.fn(),
      signInWithGoogle: vi.fn(),
    };

    mockCleanup = {
      signOut: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthApi,
        { provide: AuthStateService, useValue: mockState },
        { provide: AuthSessionService, useValue: mockSession },
        { provide: AuthCredentialsService, useValue: mockCredentials },
        { provide: AuthOAuthService, useValue: mockOAuth },
        { provide: AuthCleanupService, useValue: mockCleanup },
      ],
    });

    service = TestBed.inject(AuthApi);
  });

  it('should delegate session signal to AuthStateService', () => {
    expect(service.session()).toBeNull();
  });

  it('should delegate isLoading signal to AuthStateService', () => {
    expect(service.isLoading()).toBe(false);
  });

  it('should delegate user signal to AuthStateService', () => {
    expect(service.user()).toBeNull();
  });

  it('should delegate isAuthenticated signal to AuthStateService', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should delegate authState signal to AuthStateService', () => {
    const state = service.authState();
    expect(state).toEqual({
      session: null,
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it('should delegate getOAuthUserMetadata to AuthOAuthService', () => {
    const mockMetadata = { givenName: 'John', fullName: 'John Doe' };
    vi.mocked(mockOAuth.getOAuthUserMetadata).mockReturnValue(mockMetadata);

    const result = service.getOAuthUserMetadata();

    expect(result).toEqual(mockMetadata);
    expect(mockOAuth.getOAuthUserMetadata).toHaveBeenCalled();
  });

  it('should delegate initializeAuthState to AuthSessionService', async () => {
    await service.initializeAuthState();

    expect(mockSession.initializeAuthState).toHaveBeenCalled();
  });

  it('should delegate signInWithEmail to AuthCredentialsService', async () => {
    vi.mocked(mockCredentials.signInWithEmail).mockResolvedValue({
      success: true,
    });

    const result = await service.signInWithEmail(
      'test@example.com',
      'password',
    );

    expect(result).toEqual({ success: true });
    expect(mockCredentials.signInWithEmail).toHaveBeenCalledWith(
      'test@example.com',
      'password',
    );
  });

  it('should delegate signUpWithEmail to AuthCredentialsService', async () => {
    vi.mocked(mockCredentials.signUpWithEmail).mockResolvedValue({
      success: true,
    });

    const result = await service.signUpWithEmail(
      'test@example.com',
      'password',
    );

    expect(result).toEqual({ success: true });
    expect(mockCredentials.signUpWithEmail).toHaveBeenCalledWith(
      'test@example.com',
      'password',
    );
  });

  it('should delegate signInWithGoogle to AuthOAuthService', async () => {
    vi.mocked(mockOAuth.signInWithGoogle).mockResolvedValue({ success: true });

    const result = await service.signInWithGoogle();

    expect(result).toEqual({ success: true });
    expect(mockOAuth.signInWithGoogle).toHaveBeenCalled();
  });

  it('should delegate setSession to AuthSessionService', async () => {
    const session = { access_token: 'token', refresh_token: 'refresh' };
    vi.mocked(mockSession.setSession).mockResolvedValue({ success: true });

    const result = await service.setSession(session);

    expect(result).toEqual({ success: true });
    expect(mockSession.setSession).toHaveBeenCalledWith(session);
  });

  it('should delegate signOut to AuthSessionService', async () => {
    await service.signOut();

    expect(mockSession.signOut).toHaveBeenCalled();
  });

  it('should delegate getCurrentSession to AuthSessionService', async () => {
    const mockSessionData = { user: { id: 'user-123' } } as Session;
    vi.mocked(mockSession.getCurrentSession).mockResolvedValue(mockSessionData);

    const result = await service.getCurrentSession();

    expect(result).toEqual(mockSessionData);
    expect(mockSession.getCurrentSession).toHaveBeenCalled();
  });

  it('should delegate refreshSession to AuthSessionService', async () => {
    vi.mocked(mockSession.refreshSession).mockResolvedValue(true);

    const result = await service.refreshSession();

    expect(result).toBe(true);
    expect(mockSession.refreshSession).toHaveBeenCalled();
  });

  it('should expose currentUser getter from AuthStateService', () => {
    const result = service.currentUser;

    expect(result).toBeNull();
  });

  it('should expose currentSession getter from AuthStateService', () => {
    const result = service.currentSession;

    expect(result).toBeNull();
  });
});
