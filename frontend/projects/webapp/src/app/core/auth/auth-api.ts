import { Injectable, inject } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { AuthStateService, type AuthState } from './auth-state.service';
import { AuthSessionService } from './auth-session.service';
import { AuthCredentialsService } from './auth-credentials.service';
import { AuthOAuthService, type OAuthUserMetadata } from './auth-oauth.service';

export type { OAuthUserMetadata };

/**
 * @deprecated This facade is maintained for backward compatibility.
 * For new code, inject specific services:
 * - AuthStateService for state signals
 * - AuthCredentialsService for email/password auth
 * - AuthOAuthService for OAuth
 * - AuthSessionService for logout
 *
 * Will be removed in v2.0
 */
@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  readonly #state = inject(AuthStateService);
  readonly #session = inject(AuthSessionService);
  readonly #credentials = inject(AuthCredentialsService);
  readonly #oauth = inject(AuthOAuthService);

  readonly session = this.#state.session;
  readonly isLoading = this.#state.isLoading;
  readonly user = this.#state.user;
  readonly isAuthenticated = this.#state.isAuthenticated;
  readonly authState = this.#state.authState;

  getOAuthUserMetadata(): OAuthUserMetadata | null {
    return this.#oauth.getOAuthUserMetadata();
  }

  async initializeAuthState(): Promise<void> {
    return this.#session.initializeAuthState();
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.#credentials.signInWithEmail(email, password);
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.#credentials.signUpWithEmail(email, password);
  }

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    return this.#oauth.signInWithGoogle();
  }

  async setSession(session: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.#session.setSession(session);
  }

  async signOut(): Promise<void> {
    return this.#session.signOut();
  }

  async getCurrentSession(): Promise<Session | null> {
    return this.#session.getCurrentSession();
  }

  async refreshSession(): Promise<boolean> {
    return this.#session.refreshSession();
  }

  get currentUser(): User | null {
    return this.#state.user();
  }

  get currentSession(): Session | null {
    return this.#state.session();
  }
}

export type { AuthState };
