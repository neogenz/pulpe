import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { Session } from '@supabase/supabase-js';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;

  const mockSession: Session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
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
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthStateService);
  });

  it('should initialize with null session and loading true', () => {
    expect(service.session()).toBeNull();
    expect(service.isLoading()).toBe(true);
    expect(service.user()).toBeNull();
  });

  it('should update session when setSession is called', () => {
    service.setSession(mockSession);

    expect(service.session()).toEqual(mockSession);
    expect(service.user()).toEqual(mockSession.user);
  });

  it('should clear user when session is set to null', () => {
    service.setSession(mockSession);
    expect(service.user()).toEqual(mockSession.user);

    service.setSession(null);

    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
  });

  it('should update loading state when setLoading is called', () => {
    service.setLoading(false);

    expect(service.isLoading()).toBe(false);

    service.setLoading(true);

    expect(service.isLoading()).toBe(true);
  });

  it('should compute isAuthenticated as false when no session', () => {
    service.setLoading(false);

    expect(service.isAuthenticated()).toBe(false);
  });

  it('should compute isAuthenticated as false when loading', () => {
    service.setSession(mockSession);
    service.setLoading(true);

    expect(service.isAuthenticated()).toBe(false);
  });

  it('should compute isAuthenticated as true when session exists and not loading', () => {
    service.setSession(mockSession);
    service.setLoading(false);

    expect(service.isAuthenticated()).toBe(true);
  });

  it('should aggregate all signals in authState', () => {
    service.setSession(mockSession);
    service.setLoading(false);

    const state = service.authState();

    expect(state).toEqual({
      user: mockSession.user,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    });
  });

  it('should update authState when session changes', () => {
    service.setSession(mockSession);
    service.setLoading(false);
    expect(service.authState().isAuthenticated).toBe(true);

    service.setSession(null);

    expect(service.authState()).toEqual({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe('state transition consistency', () => {
    it('should update all signals atomically when transitioning from authenticated to unauthenticated', () => {
      service.setSession(mockSession);
      service.setLoading(false);

      expect(service.user()).not.toBeNull();
      expect(service.session()).not.toBeNull();
      expect(service.isAuthenticated()).toBe(true);
      expect(service.authState().isAuthenticated).toBe(true);

      service.setSession(null);

      expect(service.user()).toBeNull();
      expect(service.session()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.authState()).toEqual({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    });

    it('should update isAuthenticated atomically when loading state changes', () => {
      service.setSession(mockSession);
      service.setLoading(false);
      expect(service.isAuthenticated()).toBe(true);

      service.setLoading(true);

      expect(service.isAuthenticated()).toBe(false);
      expect(service.session()).not.toBeNull();
      expect(service.user()).not.toBeNull();

      const state = service.authState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(state.session).not.toBeNull();
    });
  });
});
