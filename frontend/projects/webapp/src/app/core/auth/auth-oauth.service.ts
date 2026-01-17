import { Injectable, inject } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { ROUTES } from '../routing/routes-constants';
import { isE2EMode } from './e2e-window';

export interface OAuthUserMetadata {
  givenName?: string;
  fullName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthOAuthService {
  readonly #session = inject(AuthSessionService);
  readonly #state = inject(AuthStateService);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);

  getOAuthUserMetadata(): OAuthUserMetadata | null {
    const session = this.#state.session();
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

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du signin Google');
      return { success: true };
    }

    try {
      const { error } = await this.#session.getClient().auth.signInWithOAuth({
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

  #isE2EBypass(): boolean {
    return isE2EMode();
  }
}
