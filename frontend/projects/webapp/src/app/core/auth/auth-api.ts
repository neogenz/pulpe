import { Injectable, inject, signal, computed } from '@angular/core';
import {
  createClient,
  type Session,
  type User,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { ROUTES } from '../routing/routes-constants';
import { HasBudgetState } from './has-budget-state';

export interface OAuthUserMetadata {
  givenName?: string;
  fullName?: string;
}

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

/**
 * Extended Window interface for E2E testing.
 * Matches the E2EWindow type from e2e/types/e2e.types.ts
 */
interface E2EWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: AuthState;
}

@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #demoModeService = inject(DemoModeService);
  readonly #postHogService = inject(PostHogService);
  readonly #storageService = inject(StorageService);
  readonly #hasBudgetState = inject(HasBudgetState);

  // Supabase client - créé dans initializeAuthState() après le chargement de la config
  #supabaseClient: SupabaseClient | null = null;

  readonly #sessionSignal = signal<Session | null>(null);
  readonly #isLoadingSignal = signal<boolean>(true);
  readonly #userSignal = computed(() => {
    const session = this.#sessionSignal();
    if (!session) return null;
    return session.user;
  });

  // Computed signals pour l'état dérivé (aligned with Angular resource() API)
  readonly session = this.#sessionSignal.asReadonly();
  readonly isLoading = this.#isLoadingSignal.asReadonly();
  readonly hasValue = computed(() => !!this.#userSignal());
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

  getOAuthUserMetadata(): OAuthUserMetadata | null {
    const session = this.#sessionSignal();
    if (!session?.user?.user_metadata) {
      return null;
    }

    const metadata = session.user.user_metadata as Record<string, unknown>;
    const givenName =
      typeof metadata['given_name'] === 'string'
        ? metadata['given_name']
        : undefined;
    const fullName =
      typeof metadata['full_name'] === 'string'
        ? metadata['full_name']
        : undefined;

    if (!givenName && !fullName) {
      return null;
    }

    return { givenName, fullName };
  }

  async initializeAuthState(): Promise<void> {
    // À ce point, applicationConfig.initialize() a déjà été appelé
    // Les valeurs sont garanties d'être disponibles
    const url = this.#applicationConfig.supabaseUrl();
    const key = this.#applicationConfig.supabaseAnonKey();

    if (!url || !key) {
      throw new Error('Configuration Supabase manquante après initialisation');
    }

    // Créer le client Supabase une seule fois
    this.#supabaseClient = createClient(url, key);

    // Vérifier si on est en mode test E2E et utiliser les mocks
    if (this.#isE2EBypass()) {
      const mockState = this.#getE2EMockState();
      if (mockState) {
        this.#logger.info(
          '🎭 Mode test E2E détecté, utilisation des mocks auth',
        );
        this.#sessionSignal.set(mockState.session);
        this.#isLoadingSignal.set(mockState.isLoading);

        // Configurer un observateur pour les changements de mock state
        this.#setupMockStateObserver();
        return;
      }
    }

    try {
      const {
        data: { session },
        error,
      } = await this.#supabaseClient.auth.getSession();

      if (error) {
        this.#logger.error(
          'Erreur lors de la récupération de la session:',
          error,
        );
        this.updateAuthState(null);
        return;
      }

      this.updateAuthState(session);

      // Écouter les changements d'authentification
      this.#supabaseClient.auth.onAuthStateChange((event, session) => {
        this.#logger.debug('Auth event:', {
          event,
          session: session?.user?.id,
        });

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            this.updateAuthState(session);
            break;
          case 'SIGNED_OUT': {
            // Capture user ID BEFORE clearing state to preserve their tour keys
            const userId = this.#userSignal()?.id;
            this.updateAuthState(null);
            this.handleSignOut(userId);
            break;
          }
          case 'USER_UPDATED':
            this.updateAuthState(session);
            break;
        }
      });
    } catch (error) {
      this.#logger.error(
        "Erreur lors de l'initialisation de l'authentification:",
        error,
      );
      this.updateAuthState(null);
    }
  }

  #setupMockStateObserver(): void {
    // E2E mock state is set once at test initialization and doesn't change during the test
    // No need for continuous polling - this was preventing networkidle state in Playwright tests
    this.#logger.debug(
      '🎭 E2E mock auth state applied (one-time setup, no polling)',
    );
  }

  #isE2EBypass(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as E2EWindow).__E2E_AUTH_BYPASS__ === true
    );
  }

  #getE2EMockState(): AuthState | undefined {
    return (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  }

  #setE2EMockState(state: AuthState): void {
    (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = state;
  }

  private updateAuthState(session: Session | null): void {
    this.#sessionSignal.set(session);
    this.#isLoadingSignal.set(false);
  }

  private handleSignOut(userId?: string): void {
    // Clear demo mode state BEFORE clearing other data
    // This ensures demo state is reset on ALL logout paths (menu, auth errors, etc.)
    // Note: This also updates internal signals, not just localStorage
    this.#demoModeService.deactivateDemoMode();

    // Clear budget state cache so guard re-checks on next login
    this.#hasBudgetState.clear();

    // Reset analytics identity to prevent tracking new user with old identity
    this.#postHogService.reset();

    // Clear all user data from localStorage (type-safe via StorageService)
    // Pass userId to preserve only this user's tour keys, remove other users' tour data
    this.#storageService.clearAll(userId);
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du signin');
      return { success: true };
    }

    try {
      const { error } = await this.#supabaseClient!.auth.signInWithPassword({
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
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_LOGIN_ERROR,
      };
    }
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du signup');
      return { success: true };
    }

    try {
      const { error } = await this.#supabaseClient!.auth.signUp({
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
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_SIGNUP_ERROR,
      };
    }
  }

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du signin Google');
      return { success: true };
    }

    try {
      const { error } = await this.#supabaseClient!.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/${ROUTES.APP}`,
        },
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
        error: AUTH_ERROR_MESSAGES.GOOGLE_CONNECTION_ERROR,
      };
    }
  }

  /**
   * Set a Supabase session programmatically (e.g., for demo mode)
   * This allows setting a session obtained from a backend endpoint
   *
   * ⚠️ WARNING: This method does NOT check for __E2E_AUTH_BYPASS__
   * For E2E tests, auth state must already be mocked via __E2E_MOCK_AUTH_STATE__
   * in initializeAuthState(). Do not call this method in E2E bypass paths.
   */
  async setSession(session: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.#supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.#supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      // Update auth state - this will trigger reactive updates
      this.updateAuthState(data.session);

      this.#logger.info('Session set successfully', {
        userId: data.session?.user?.id,
      });

      return { success: true };
    } catch (error) {
      this.#logger.error('Error setting session:', error);
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_SESSION_ERROR,
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.#isE2EBypass()) {
        this.#logger.info('🎭 Mode test E2E: Simulation du logout');
        // Capture user ID BEFORE clearing state to preserve their tour keys
        const userId = this.#userSignal()?.id;
        this.#setE2EMockState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        });
        this.updateAuthState(null);
        this.handleSignOut(userId);
        return;
      }

      // Logout normal avec Supabase
      const { error } = await this.#supabaseClient!.auth.signOut();
      if (error) {
        this.#logger.error('Erreur lors de la déconnexion:', error);
      }
    } catch (error) {
      this.#logger.error('Erreur inattendue lors de la déconnexion:', error);
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const {
        data: { session },
        error,
      } = await this.#supabaseClient!.auth.getSession();

      if (error) {
        this.#logger.error(
          'Erreur lors de la récupération de la session:',
          error,
        );
        return null;
      }

      return session;
    } catch (error) {
      this.#logger.error(
        'Erreur inattendue lors de la récupération de la session:',
        error,
      );
      return null;
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      const { data, error } = await this.#supabaseClient!.auth.refreshSession();

      if (error) {
        this.#logger.error(
          'Erreur lors du rafraîchissement de la session:',
          error,
        );
        return false;
      }

      return !!data.session;
    } catch (error) {
      this.#logger.error(
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
