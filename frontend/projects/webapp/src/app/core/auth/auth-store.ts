import { Injectable, signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { ANALYTICS_PROPERTIES } from 'pulpe-shared';

/** Derived view for templates: user, session, loading / authenticated flags. */
export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

/**
 * Source of truth for where the auth session stands, with optional Supabase {@link Session} payload.
 * Distinct from {@link AuthState}, the flattened UI-facing aggregate (`authState`).
 */
export type AuthSessionState =
  | { readonly phase: 'booting' }
  | { readonly phase: 'authenticated'; readonly session: Session }
  | { readonly phase: 'unauthenticated' };

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  readonly #sessionState = signal<AuthSessionState>({ phase: 'booting' });

  readonly session = computed<Session | null>(() => {
    const sessionState = this.#sessionState();
    return sessionState.phase === 'authenticated' ? sessionState.session : null;
  });

  readonly user = computed<User | null>(() => this.session()?.user ?? null);

  readonly isLoading = computed(() => this.#sessionState().phase === 'booting');

  readonly isAuthenticated = computed(
    () => this.#sessionState().phase === 'authenticated',
  );

  readonly isEarlyAdopter = computed(
    () => !!this.user()?.app_metadata?.[ANALYTICS_PROPERTIES.EARLY_ADOPTER],
  );

  readonly isOAuthOnly = computed(() => {
    const user = this.user();
    if (!user) return false;

    const rawProviders = user.app_metadata?.['providers'];
    const providers =
      Array.isArray(rawProviders) &&
      rawProviders.every((p): p is string => typeof p === 'string')
        ? rawProviders
        : (user.identities ?? [])
            .map((identity) => identity.provider)
            .filter((p): p is string => typeof p === 'string');

    return providers.length > 0 && providers.every((p) => p !== 'email');
  });

  readonly authState = computed<AuthState>(() => ({
    user: this.user(),
    session: this.session(),
    isLoading: this.isLoading(),
    isAuthenticated: this.isAuthenticated(),
  }));

  /** Atomically replaces session state (same idea as `cachedResource.set()` / single signal write). */
  set(next: AuthSessionState): void {
    this.#sessionState.set(next);
  }
}
