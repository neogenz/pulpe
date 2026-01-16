import { Injectable, inject } from '@angular/core';
import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { AuthStateService, type AuthState } from './auth-state.service';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { AuthCleanupService } from './auth-cleanup.service';
import { isE2EMode, type E2EWindow } from './e2e-window';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  readonly #state = inject(AuthStateService);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);
  readonly #cleanup = inject(AuthCleanupService);

  #supabaseClient: SupabaseClient | null = null;

  getClient(): SupabaseClient {
    if (!this.#supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    return this.#supabaseClient;
  }

  async initializeAuthState(): Promise<void> {
    this.#state.setLoading(true);
    const url = this.#applicationConfig.supabaseUrl();
    const key = this.#applicationConfig.supabaseAnonKey();

    if (!url || !key) {
      throw new Error('Configuration Supabase manquante après initialisation');
    }

    this.#supabaseClient = createClient(url, key);

    if (this.#isE2EBypass()) {
      const mockState = this.#getE2EMockState();
      if (mockState) {
        this.#logger.info(
          '🎭 Mode test E2E détecté, utilisation des mocks auth',
        );
        this.#state.setSession(mockState.session);
        this.#state.setLoading(mockState.isLoading);
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
        this.#updateAuthState(null);
        return;
      }

      this.#updateAuthState(session);

      this.#supabaseClient.auth.onAuthStateChange((event, session) => {
        this.#logger.debug('Auth event:', {
          event,
          session: session?.user?.id,
        });

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            this.#updateAuthState(session);
            break;
          case 'SIGNED_OUT': {
            const userId = this.#state.user()?.id;
            this.#updateAuthState(null);
            this.#cleanup.performCleanup(userId);
            break;
          }
          case 'USER_UPDATED':
            this.#updateAuthState(session);
            break;
        }
      });
    } catch (error) {
      this.#logger.error(
        "Erreur lors de l'initialisation de l'authentification:",
        error,
      );
      this.#updateAuthState(null);
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const {
        data: { session },
        error,
      } = await this.getClient().auth.getSession();

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
      const { data, error } = await this.getClient().auth.refreshSession();

      if (error) {
        this.#logger.error(
          'Erreur lors du rafraîchissement de la session:',
          error,
        );
        return false;
      }

      this.#state.setSession(data.session ?? null);
      return !!data.session;
    } catch (error) {
      this.#logger.error(
        'Erreur inattendue lors du rafraîchissement de la session:',
        error,
      );
      return false;
    }
  }

  async setSession(session: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.getClient().auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      this.#state.setSession(data.session);

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
    const userId = this.#state.user()?.id;

    try {
      if (this.#isE2EBypass()) {
        this.#logger.info('🎭 Mode test E2E: Simulation du logout');
        this.#updateAuthState(null);
        this.#cleanup.performCleanup(userId);
        return;
      }

      const { error } = await this.getClient().auth.signOut();
      if (error) {
        this.#logger.error('Erreur lors de la déconnexion:', error);
      }
      this.#updateAuthState(null);
    } catch (error) {
      this.#logger.error('Erreur inattendue lors de la déconnexion:', error);
    }
  }

  #updateAuthState(session: Session | null): void {
    this.#state.setSession(session);
    this.#state.setLoading(false);
  }

  #setupMockStateObserver(): void {
    this.#logger.debug(
      '🎭 E2E mock auth state applied (one-time setup, no polling)',
    );
  }

  #isE2EBypass(): boolean {
    return isE2EMode();
  }

  #getE2EMockState(): AuthState | undefined {
    return (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  }
}
