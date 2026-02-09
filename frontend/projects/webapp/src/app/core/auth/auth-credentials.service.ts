import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ClientKeyService, EncryptionApi } from '@core/encryption';

import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { AuthErrorLocalizer } from './auth-error-localizer';
import { Logger } from '../logging/logger';
import { AUTH_ERROR_MESSAGES } from './auth-constants';
import { isE2EMode } from './e2e-window';

@Injectable({
  providedIn: 'root',
})
export class AuthCredentialsService {
  readonly #session = inject(AuthSessionService);
  readonly #state = inject(AuthStateService);
  readonly #errorLocalizer = inject(AuthErrorLocalizer);
  readonly #logger = inject(Logger);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du signin');
      return { success: true };
    }

    try {
      this.#state.setLoading(true);
      const { data, error } = await this.#session
        .getClient()
        .auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      if (data.session?.user?.user_metadata?.['scheduledDeletionAt']) {
        this.#logger.warn('Login attempt with account scheduled for deletion', {
          userId: data.session.user.id,
        });
        await this.#session.signOut();
        return {
          success: false,
          error:
            'Ton compte est en attente de suppression et ne peut plus être utilisé.',
        };
      }

      this.#state.setSession(data.session ?? null);

      // Migration: derive client key from password for existing users
      // who have not yet set up a vault code. New vault-code users skip this.
      const hasVaultCode =
        !!data.session?.user?.user_metadata?.['vaultCodeConfigured'];
      if (!hasVaultCode) {
        try {
          await this.#deriveClientKey(password);
        } catch (encryptionError) {
          this.#logger.error(
            'Encryption key derivation failed during sign-in',
            { error: encryptionError },
          );
          await this.#session.signOut();
          return {
            success: false,
            error: AUTH_ERROR_MESSAGES.ENCRYPTION_SETUP_ERROR,
          };
        }
      }

      return { success: true };
    } catch (error) {
      this.#logger.error('Unexpected error during sign-in', {
        error,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_LOGIN_ERROR,
      };
    } finally {
      this.#state.setLoading(false);
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
      this.#state.setLoading(true);
      const { data, error } = await this.#session.getClient().auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: this.#errorLocalizer.localizeError(error.message),
        };
      }

      this.#state.setSession(data.session ?? null);
      // Signup never migrates existing encrypted data. Clear any leftover key
      // to avoid treating new users as migration mode in setup-vault-code.
      this.#clientKeyService.clear();

      // New users will set up their vault code after signup.
      // No client key derivation from password — the encryption guard
      // redirects to setup-vault-code.

      return { success: true };
    } catch (error) {
      this.#logger.error('Unexpected error during sign-up', {
        error,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.UNEXPECTED_SIGNUP_ERROR,
      };
    } finally {
      this.#state.setLoading(false);
    }
  }

  async #deriveClientKey(password: string): Promise<void> {
    const { salt, kdfIterations } = await firstValueFrom(
      this.#encryptionApi.getSalt$(),
    );
    await this.#clientKeyService.deriveAndStore(
      password,
      salt,
      kdfIterations,
      false,
    );
  }

  #isE2EBypass(): boolean {
    return isE2EMode();
  }
}
