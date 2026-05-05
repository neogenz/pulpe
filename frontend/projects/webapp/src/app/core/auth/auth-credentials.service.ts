import { Injectable, inject, LOCALE_ID } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ClientKeyService } from '@core/encryption';

import { AuthSessionService } from './auth-session.service';
import { AuthStore } from './auth-store';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_KEYS, formatDeletionDate } from './auth-constants';
import { isE2EMode } from './e2e-window';

type CredentialMethod = 'signInWithPassword' | 'signUp';

interface CredentialFlowOptions {
  readonly clearClientKeyOnSuccess: boolean;
  readonly fallbackErrorKey: string;
  readonly logLabel: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthCredentialsService {
  readonly #session = inject(AuthSessionService);
  readonly #authStore = inject(AuthStore);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);

  signInWithEmail(email: string, password: string) {
    return this.#runCredentialFlow('signInWithPassword', email, password, {
      clearClientKeyOnSuccess: false,
      fallbackErrorKey: AUTH_ERROR_KEYS.UNEXPECTED_LOGIN_ERROR,
      logLabel: 'signin',
    });
  }

  signUpWithEmail(email: string, password: string) {
    return this.#runCredentialFlow('signUp', email, password, {
      clearClientKeyOnSuccess: true,
      fallbackErrorKey: AUTH_ERROR_KEYS.UNEXPECTED_SIGNUP_ERROR,
      logLabel: 'signup',
    });
  }

  async #runCredentialFlow(
    method: CredentialMethod,
    email: string,
    password: string,
    options: CredentialFlowOptions,
  ): Promise<{ success: boolean; error?: string }> {
    if (isE2EMode()) {
      this.#logger.info(`🎭 Mode test E2E: Simulation du ${options.logLabel}`);
      return { success: true };
    }

    try {
      const { data, error } = await this.#session
        .getClient()
        .auth[method]({ email, password });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeAuthError(error),
        };
      }

      const scheduledDeletionAt =
        data.session?.user?.user_metadata?.['scheduledDeletionAt'];
      if (scheduledDeletionAt) {
        this.#logger.warn('Login attempt with account scheduled for deletion', {
          userId: data.session?.user.id,
        });
        try {
          await this.#session.signOut();
        } catch (signOutError) {
          this.#logger.error(
            'signOut failed during scheduled-deletion handling',
            signOutError,
          );
        }
        return {
          success: false,
          error: this.#transloco.translate('auth.scheduledDeletion', {
            date: formatDeletionDate(scheduledDeletionAt, this.#locale),
          }),
        };
      }

      if (data.session) {
        this.#authStore.set({
          phase: 'authenticated',
          session: data.session,
        });
      }

      if (options.clearClientKeyOnSuccess) {
        this.#clientKeyService.clear();
      }

      return { success: true };
    } catch (error) {
      this.#logger.error(`Unexpected error during ${options.logLabel}`, error);
      return {
        success: false,
        error: this.#transloco.translate(options.fallbackErrorKey),
      };
    }
  }
}
