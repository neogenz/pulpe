import { Injectable, signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { ANALYTICS_PROPERTIES } from 'pulpe-shared';

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

export type AuthSnapshot =
  | { readonly phase: 'booting' }
  | { readonly phase: 'authenticated'; readonly session: Session }
  | { readonly phase: 'unauthenticated' };

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  readonly #snapshot = signal<AuthSnapshot>({ phase: 'booting' });

  readonly session = computed<Session | null>(() => {
    const snapshot = this.#snapshot();
    return snapshot.phase === 'authenticated' ? snapshot.session : null;
  });

  readonly user = computed<User | null>(() => this.session()?.user ?? null);

  readonly isLoading = computed(() => this.#snapshot().phase === 'booting');

  readonly isAuthenticated = computed(
    () => this.#snapshot().phase === 'authenticated',
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

  applyState(snapshot: AuthSnapshot): void {
    this.#snapshot.set(snapshot);
  }
}
