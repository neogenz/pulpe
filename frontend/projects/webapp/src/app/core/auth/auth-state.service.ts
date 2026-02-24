import { Injectable, signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';

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

  readonly isOAuthOnly = computed(() => {
    const user = this.#userSignal();
    const providers: string[] | undefined = user?.app_metadata?.['providers'];
    if (!providers?.length) return false;
    return providers.every((provider) => provider !== 'email');
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
