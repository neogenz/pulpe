import { Injectable, inject, signal, computed } from '@angular/core';
import {
  type Session,
  type User,
  type AuthChangeEvent,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthErrorLocalizer } from './auth-error-localizer';

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  readonly #errorLocalizer = inject(AuthErrorLocalizer);

  #supabaseClient: any = null;

  readonly #sessionSignal = signal<Session | null>(null);
  readonly #isLoadingSignal = signal<boolean>(true);
  readonly #userSignal = computed(() => {
    const session = this.#sessionSignal();
    if (!session) return null;
    return session.user;
  });

  // Computed signals pour l'état dérivé
  readonly session = this.#sessionSignal.asReadonly();
  readonly isLoading = this.#isLoadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => {
    return (
      !!this.#userSignal() &&
      !!this.#sessionSignal() &&
      !this.#isLoadingSignal()
    );
  });

  // État complet pour la compatibilité
  readonly authState = computed<AuthState>(() => ({
    user: this.#userSignal(),
    session: this.#sessionSignal(),
    isLoading: this.#isLoadingSignal(),
    isAuthenticated: this.isAuthenticated(),
  }));

  async #ensureSupabaseClient(): Promise<any> {
    if (!this.#supabaseClient) {
      const { createClient } = await import('@supabase/supabase-js');
      this.#supabaseClient = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
      );
    }
    return this.#supabaseClient;
  }

  async initializeAuthState(): Promise<void> {
    // Vérifier si on est en mode test E2E et utiliser les mocks
    if (
      (window as unknown as { __E2E_AUTH_BYPASS__: boolean })
        .__E2E_AUTH_BYPASS__
    ) {
      const mockState = (
        window as unknown as { __E2E_MOCK_AUTH_STATE__: AuthState }
      ).__E2E_MOCK_AUTH_STATE__;
      if (mockState) {
        console.log('🎭 Mode test E2E détecté, utilisation des mocks auth');
        this.#sessionSignal.set(mockState.session);
        this.#isLoadingSignal.set(false);
        return;
      }
    }

    try {
      const client = await this.#ensureSupabaseClient();
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        this.updateAuthState(null);
        return;
      }

      this.updateAuthState(session);

      // Écouter les changements d'authentification
      client.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          console.log('Auth event:', event, session);

          switch (event) {
            case 'SIGNED_IN':
            case 'TOKEN_REFRESHED':
              this.updateAuthState(session);
              break;
            case 'SIGNED_OUT':
              this.updateAuthState(null);
              this.handleSignOut();
              break;
            case 'USER_UPDATED':
              this.updateAuthState(session);
              break;
          }
        },
      );
    } catch (error) {
      console.error(
        "Erreur lors de l'initialisation de l'authentification:",
        error,
      );
      this.updateAuthState(null);
    }
  }

  private updateAuthState(session: Session | null): void {
    this.#sessionSignal.set(session);
    this.#isLoadingSignal.set(false);
  }

  private handleSignOut(): void {
    // Nettoyer le localStorage et autres états liés à l'utilisateur
    try {
      localStorage.removeItem('pulpe-onboarding-completed');
    } catch (error) {
      console.warn(
        'Failed to clear onboarding status from localStorage:',
        error,
      );
    }
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.#ensureSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Erreur inattendue lors de la connexion',
      };
    }
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.#ensureSupabaseClient();
      const { error } = await client.auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: "Erreur inattendue lors de l'inscription",
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      const client = await this.#ensureSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    } catch (error) {
      console.error('Erreur inattendue lors de la déconnexion:', error);
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const client = await this.#ensureSupabaseClient();
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error(
        'Erreur inattendue lors de la récupération de la session:',
        error,
      );
      return null;
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      const client = await this.#ensureSupabaseClient();
      const { data, error } = await client.auth.refreshSession();

      if (error) {
        console.error('Erreur lors du rafraîchissement de la session:', error);
        return false;
      }

      return !!data.session;
    } catch (error) {
      console.error(
        'Erreur inattendue lors du rafraîchissement de la session:',
        error,
      );
      return false;
    }
  }

  get currentUser(): User | null {
    return this.#userSignal();
  }

  get currentSession(): Session | null {
    return this.#sessionSignal();
  }
}
