import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { AuthStateService, type AuthSnapshot } from './auth-state.service';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { AUTH_ERROR_KEYS, SCHEDULED_DELETION_PARAMS } from './auth-constants';
import { AuthCleanupService } from './auth-cleanup.service';
import { isE2EMode, type E2EWindow } from './e2e-window';
import { ROUTES } from '@core/routing/routes-constants';

interface DecodedJwt {
  readonly sub: string;
  readonly exp: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  readonly #state = inject(AuthStateService);
  readonly #router = inject(Router);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);
  readonly #cleanup = inject(AuthCleanupService);
  readonly #transloco = inject(TranslocoService);
  readonly #destroyRef = inject(DestroyRef);

  #supabaseClient: SupabaseClient | null = null;
  #authSubscription: (() => void) | null = null;
  #initPromise: Promise<void> | null = null;
  #refreshPromise: Promise<boolean> | null = null;

  getClient(): SupabaseClient {
    if (!this.#supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    return this.#supabaseClient;
  }

  initializeAuthState(): Promise<void> {
    if (this.#supabaseClient) {
      this.#logger.debug('Auth already initialized, skipping');
      return Promise.resolve();
    }
    return (this.#initPromise ??= this.#doInitializeAuthState());
  }

  async #doInitializeAuthState(): Promise<void> {
    const url = this.#applicationConfig.supabaseUrl();
    const key = this.#applicationConfig.supabaseAnonKey();

    if (!url || !key) {
      throw new Error('Configuration Supabase manquante après initialisation');
    }

    this.#supabaseClient = createClient(url, key);

    if (isE2EMode()) {
      const mockState = this.#getE2EMockState();
      if (mockState) {
        this.#logger.debug(
          '🎭 Mode test E2E détecté, utilisation des mocks auth',
        );
        this.#state.applyState(this.#snapshotFromMock(mockState));
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
        this.#applySession(null);
        return;
      }

      this.#applySession(session);

      const { data } = this.#supabaseClient.auth.onAuthStateChange(
        (event, session) => {
          this.#handleAuthEvent(event, session);
        },
      );

      this.#authSubscription = () => data.subscription.unsubscribe();
      this.#destroyRef.onDestroy(() => this.#authSubscription?.());
    } catch (error) {
      this.#logger.error(
        "Erreur lors de l'initialisation de l'authentification:",
        error,
      );
      this.#applySession(null);
    }
  }

  refreshSession(): Promise<boolean> {
    return (this.#refreshPromise ??= this.#doRefreshSession().finally(() => {
      this.#refreshPromise = null;
    }));
  }

  async #doRefreshSession(): Promise<boolean> {
    try {
      const { data, error } = await this.getClient().auth.refreshSession();

      if (error) {
        this.#logger.error(
          'Erreur lors du rafraîchissement de la session:',
          error,
        );
        return false;
      }

      this.#applySession(data.session ?? null);
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
    const decoded = this.#decodeJwt(session.access_token);
    if (!decoded) {
      this.#logger.warn('setSession rejected: malformed access token');
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.UNEXPECTED_SESSION_ERROR,
        ),
      };
    }

    if (decoded.exp * 1000 <= Date.now()) {
      this.#logger.warn('setSession rejected: access token expired');
      return {
        success: false,
        error: this.#transloco.translate(AUTH_ERROR_KEYS.SESSION_EXPIRED),
      };
    }

    try {
      this.#logger.info('Applying session', { userId: decoded.sub });

      const { data, error } = await this.getClient().auth.setSession(session);

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeAuthError(error),
        };
      }

      this.#applySession(data.session);
      return { success: true };
    } catch (error) {
      this.#logger.error('Error setting session:', error);
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.UNEXPECTED_SESSION_ERROR,
        ),
      };
    }
  }

  async verifyPassword(
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const email = this.#state.user()?.email;
      if (!email) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      const { error } = await this.getClient().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeAuthError(error),
        };
      }

      return { success: true };
    } catch (error) {
      this.#logger.error('Error verifying password:', error);
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.UNEXPECTED_SESSION_ERROR,
        ),
      };
    }
  }

  async updatePassword(
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (isE2EMode()) {
      this.#logger.info(
        '🎭 Mode test E2E: Simulation du changement de mot de passe',
      );
      return { success: true };
    }

    try {
      const { error } = await this.getClient().auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeAuthError(error),
        };
      }

      return { success: true };
    } catch (error) {
      this.#logger.error('Error updating password:', error);
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.UNEXPECTED_SESSION_ERROR,
        ),
      };
    }
  }

  async signOut(): Promise<void> {
    if (isE2EMode()) {
      this.#logger.debug('🎭 Mode test E2E: Simulation du logout');
      this.#state.applyState({ phase: 'unauthenticated' });
      return;
    }

    if (!this.#supabaseClient) {
      this.#state.applyState({ phase: 'unauthenticated' });
      return;
    }

    try {
      const { error } = await this.#supabaseClient.auth.signOut();
      if (error) {
        this.#logger.error(
          'Erreur lors de la déconnexion globale, fallback local',
          error,
        );
        await this.#localSignOut();
      }
    } catch (error) {
      this.#logger.error('Erreur inattendue lors de la déconnexion:', error);
      await this.#localSignOut();
    } finally {
      this.#state.applyState({ phase: 'unauthenticated' });
      this.#cleanup.performCleanup();
    }
  }

  async resetPasswordForEmail(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await this.getClient().auth.resetPasswordForEmail(
        email,
        { redirectTo },
      );

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeAuthError(error),
        };
      }

      return { success: true };
    } catch (error) {
      this.#logger.error('Error sending password reset email:', error);
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.UNEXPECTED_SESSION_ERROR,
        ),
      };
    }
  }

  async #localSignOut(): Promise<void> {
    if (!this.#supabaseClient) return;
    try {
      await this.#supabaseClient.auth.signOut({ scope: 'local' });
    } catch (error) {
      this.#logger.error('Local signOut failed', error);
    }
  }

  #handleAuthEvent(event: string, session: Session | null): void {
    this.#logger.debug('Auth event:', { event, session: session?.user?.id });

    if (
      (event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED') &&
      session?.user?.user_metadata?.['scheduledDeletionAt']
    ) {
      const deletionDate = session.user.user_metadata['scheduledDeletionAt'];
      this.#logger.warn(
        'User account scheduled for deletion detected, signing out',
        { userId: session.user.id },
      );
      this.signOut().finally(() => {
        this.#router.navigate(['/', ROUTES.LOGIN], {
          queryParams: {
            [SCHEDULED_DELETION_PARAMS.REASON]:
              SCHEDULED_DELETION_PARAMS.REASON_VALUE,
            [SCHEDULED_DELETION_PARAMS.DATE]: String(deletionDate),
          },
        });
      });
      return;
    }

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'PASSWORD_RECOVERY':
      case 'USER_UPDATED':
        this.#applySession(session);
        break;
      case 'SIGNED_OUT':
        this.#applySession(null);
        this.#cleanup.performCleanup();
        break;
    }
  }

  #applySession(session: Session | null): void {
    this.#state.applyState(
      session
        ? { phase: 'authenticated', session }
        : { phase: 'unauthenticated' },
    );
  }

  #snapshotFromMock(mock: {
    session: Session | null;
    isLoading: boolean;
  }): AuthSnapshot {
    if (mock.session) return { phase: 'authenticated', session: mock.session };
    if (mock.isLoading) return { phase: 'booting' };
    return { phase: 'unauthenticated' };
  }

  #getE2EMockState() {
    if (typeof window === 'undefined') return undefined;
    return (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  }

  #decodeJwt(token: string): DecodedJwt | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (typeof payload.exp !== 'number' || typeof payload.sub !== 'string') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}
