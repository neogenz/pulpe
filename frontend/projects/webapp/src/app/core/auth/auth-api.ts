import { Injectable, inject, signal, computed } from '@angular/core';
import {
  createClient,
  type Session,
  type User,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';

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
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #demoModeService = inject(DemoModeService);

  // Supabase client - créé dans initializeAuthState() après le chargement de la config
  #supabaseClient: SupabaseClient | null = null;

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
    if (
      (window as unknown as { __E2E_AUTH_BYPASS__: boolean })
        .__E2E_AUTH_BYPASS__
    ) {
      const mockState = (
        window as unknown as { __E2E_MOCK_AUTH_STATE__: AuthState }
      ).__E2E_MOCK_AUTH_STATE__;
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
          case 'SIGNED_OUT':
            this.updateAuthState(null);
            this.handleSignOut();
            break;
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
    // Surveiller les changements de l'état mocké toutes les 100ms
    const checkMockState = () => {
      if (
        (window as unknown as { __E2E_AUTH_BYPASS__: boolean })
          .__E2E_AUTH_BYPASS__
      ) {
        const mockState = (
          window as unknown as { __E2E_MOCK_AUTH_STATE__: AuthState }
        ).__E2E_MOCK_AUTH_STATE__;

        if (mockState) {
          // Synchroniser avec l'état mocké
          this.#sessionSignal.set(mockState.session);
          this.#isLoadingSignal.set(mockState.isLoading);
        }

        // Continuer à surveiller
        setTimeout(checkMockState, 100);
      }
    };

    // Démarrer la surveillance
    setTimeout(checkMockState, 100);
  }

  private updateAuthState(session: Session | null): void {
    this.#sessionSignal.set(session);
    this.#isLoadingSignal.set(false);
  }

  private handleSignOut(): void {
    // Clear demo mode state BEFORE clearing other data
    // This ensures demo state is reset on ALL logout paths (menu, auth errors, etc.)
    this.#demoModeService.deactivateDemoMode();

    // Nettoyer le localStorage et autres états liés à l'utilisateur
    try {
      localStorage.removeItem('pulpe-onboarding-completed');
    } catch (error) {
      this.#logger.warn(
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
        error: 'Erreur inattendue lors de la connexion',
      };
    }
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
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
        error: "Erreur inattendue lors de l'inscription",
      };
    }
  }

  /**
   * Set a Supabase session programmatically (e.g., for demo mode)
   * This allows setting a session obtained from a backend endpoint
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
        error: 'Erreur inattendue lors de la définition de la session',
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      // Gérer le logout en mode test E2E mocké
      if (
        (window as unknown as { __E2E_AUTH_BYPASS__: boolean })
          .__E2E_AUTH_BYPASS__
      ) {
        this.#logger.info('🎭 Mode test E2E: Simulation du logout');

        // Réinitialiser l'état mocké
        (
          window as unknown as { __E2E_MOCK_AUTH_STATE__: AuthState }
        ).__E2E_MOCK_AUTH_STATE__ = {
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        };

        // Mettre à jour les signaux locaux
        this.updateAuthState(null);
        this.handleSignOut();
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
