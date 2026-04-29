import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { AuthStore } from './auth-store';

describe('AuthStore', () => {
  let store: AuthStore;

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

  const applyAuthenticated = (session: Session = mockSession): void =>
    store.set({ phase: 'authenticated', session });
  const applyUnauthenticated = (): void =>
    store.set({ phase: 'unauthenticated' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    store = TestBed.inject(AuthStore);
  });

  it('should initialize in booting phase with null session', () => {
    expect(store.session()).toBeNull();
    expect(store.isLoading()).toBe(true);
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('should expose session and user when authenticated', () => {
    applyAuthenticated();

    expect(store.session()).toEqual(mockSession);
    expect(store.user()).toEqual(mockSession.user);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.isLoading()).toBe(false);
  });

  it('should clear session and user when transitioning to unauthenticated', () => {
    applyAuthenticated();
    applyUnauthenticated();

    expect(store.session()).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.isLoading()).toBe(false);
  });

  it('should compute isAuthenticated false in booting phase', () => {
    expect(store.isAuthenticated()).toBe(false);
  });

  it('should compute isAuthenticated false in unauthenticated phase', () => {
    applyUnauthenticated();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('should aggregate all signals in authState computed', () => {
    applyAuthenticated();

    expect(store.authState()).toEqual({
      user: mockSession.user,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    });
  });

  it('should update authState reactively when session changes', () => {
    applyAuthenticated();
    expect(store.authState().isAuthenticated).toBe(true);

    applyUnauthenticated();

    expect(store.authState()).toEqual({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe('isOAuthOnly', () => {
    const createSessionWithProviders = (providers: string[]): Session => ({
      ...mockSession,
      user: {
        ...mockSession.user,
        app_metadata: { provider: providers[0] ?? '', providers },
      },
    });

    it('should return false when there is no session', () => {
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should return false when app_metadata has no providers', () => {
      applyAuthenticated({
        ...mockSession,
        user: { ...mockSession.user, app_metadata: {} },
      });
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should return false when providers array is empty', () => {
      applyAuthenticated(createSessionWithProviders([]));
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should return false when user has only email provider', () => {
      applyAuthenticated(createSessionWithProviders(['email']));
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should return true when user has only Google provider', () => {
      applyAuthenticated(createSessionWithProviders(['google']));
      expect(store.isOAuthOnly()).toBe(true);
    });

    it('should return true when user has only Apple provider', () => {
      applyAuthenticated(createSessionWithProviders(['apple']));
      expect(store.isOAuthOnly()).toBe(true);
    });

    it('should return false when user has both email and Google providers', () => {
      applyAuthenticated(createSessionWithProviders(['email', 'google']));
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should update reactively when session changes', () => {
      applyAuthenticated(createSessionWithProviders(['google']));
      expect(store.isOAuthOnly()).toBe(true);

      applyUnauthenticated();
      expect(store.isOAuthOnly()).toBe(false);
    });

    it('should fall back to identities[].provider when providers array is malformed', () => {
      const malformedProvidersSession: Session = {
        ...mockSession,
        user: {
          ...mockSession.user,
          app_metadata: { providers: 'google' as unknown as string[] },
          identities: [
            {
              identity_id: 'identity-google',
              id: 'id-google',
              user_id: 'user-123',
              provider: 'google',
              identity_data: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_sign_in_at: new Date().toISOString(),
            },
          ],
        },
      };
      applyAuthenticated(malformedProvidersSession);
      expect(store.isOAuthOnly()).toBe(true);
    });

    describe('identities fallback (when app_metadata.providers is missing)', () => {
      const createSessionWithIdentities = (
        providerNames: string[],
      ): Session => ({
        ...mockSession,
        user: {
          ...mockSession.user,
          app_metadata: {},
          identities: providerNames.map((provider) => ({
            identity_id: `identity-${provider}`,
            id: `id-${provider}`,
            user_id: 'user-123',
            provider,
            identity_data: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          })),
        },
      });

      it('should return true when providers is missing but identities has only Google', () => {
        applyAuthenticated(createSessionWithIdentities(['google']));
        expect(store.isOAuthOnly()).toBe(true);
      });

      it('should return false when providers is missing but identities has email', () => {
        applyAuthenticated(createSessionWithIdentities(['email']));
        expect(store.isOAuthOnly()).toBe(false);
      });

      it('should return false when providers is missing and identities is empty', () => {
        applyAuthenticated(createSessionWithIdentities([]));
        expect(store.isOAuthOnly()).toBe(false);
      });

      it('should return false when providers is missing but identities has both email and google', () => {
        applyAuthenticated(createSessionWithIdentities(['email', 'google']));
        expect(store.isOAuthOnly()).toBe(false);
      });
    });
  });

  describe('state transition consistency', () => {
    it('should never expose session+isAuthenticated=false (no lying state)', () => {
      applyAuthenticated();

      expect(store.session()).not.toBeNull();
      expect(store.isAuthenticated()).toBe(true);
      expect(store.isLoading()).toBe(false);

      applyUnauthenticated();

      expect(store.session()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
      expect(store.isLoading()).toBe(false);
    });

    it('should atomically update authState aggregator on transitions', () => {
      applyAuthenticated();
      expect(store.authState().isAuthenticated).toBe(true);

      applyUnauthenticated();
      const state = store.authState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
    });
  });
});
