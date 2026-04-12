import { Injectable, signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { ANALYTICS_PROPERTIES } from 'pulpe-shared';

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  readonly #sessionSignal = signal<Session | null>(null);
  readonly #isLoadingSignal = signal<boolean>(true);

  readonly #userSignal = computed(() => {
    const session = this.#sessionSignal();
    if (!session) return null;
    return session.user;
  });

  readonly session = this.#sessionSignal.asReadonly();
  readonly isLoading = this.#isLoadingSignal.asReadonly();
  readonly user = this.#userSignal;

  readonly isAuthenticated = computed(() => {
    return (
      !!this.#userSignal() &&
      !!this.#sessionSignal() &&
      !this.#isLoadingSignal()
    );
  });

  readonly isEarlyAdopter = computed(
    () =>
      !!this.#userSignal()?.app_metadata?.[ANALYTICS_PROPERTIES.EARLY_ADOPTER],
  );

  readonly isOAuthOnly = computed(() => {
    const user = this.#userSignal();
    if (!user) return false;

    const providers: string[] | undefined = user.app_metadata?.['providers'];
    if (providers?.length) {
      return providers.every((provider) => provider !== 'email');
    }

    const identities = user.identities;
    if (identities?.length) {
      return identities.every((identity) => identity.provider !== 'email');
    }

    return false;
  });

  readonly authState = computed<AuthState>(() => ({
    user: this.#userSignal(),
    session: this.#sessionSignal(),
    isLoading: this.#isLoadingSignal(),
    isAuthenticated: this.isAuthenticated(),
  }));

  setSession(session: Session | null): void {
    this.#sessionSignal.set(session);
  }

  setLoading(loading: boolean): void {
    this.#isLoadingSignal.set(loading);
  }
}
