import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AuthSessionService } from './auth-session.service';
import { AuthStore } from './auth-store';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_KEYS } from './auth-constants';
import { ROUTES } from '@core/routing/routes-constants';
import { isE2EMode } from './e2e-window';

export type OAuthProvider = 'google' | 'apple';

export interface OAuthUserMetadata {
  givenName?: string;
  fullName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthOAuthService {
  readonly #session = inject(AuthSessionService);
  readonly #authStore = inject(AuthStore);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  getOAuthUserMetadata(): OAuthUserMetadata | null {
    const session = this.#authStore.session();
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

  async signInWithOAuth(
    provider: OAuthProvider,
  ): Promise<{ success: boolean; error?: string }> {
    if (isE2EMode()) {
      this.#logger.info(`🎭 Mode test E2E: Simulation du signin ${provider}`);
      return { success: true };
    }

    try {
      const { error } = await this.#session.getClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/${ROUTES.DASHBOARD}`,
        },
      });

      if (error) {
        this.#logger.error('OAuth init returned error', error);
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      return { success: true };
    } catch (error) {
      this.#logger.error('OAuth threw', error);
      return {
        success: false,
        error: this.#transloco.translate(
          AUTH_ERROR_KEYS.OAUTH_CONNECTION_ERROR,
        ),
      };
    }
  }
}
