import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import {
  type DemoSessionCreate,
  demoSessionResponseSchema,
} from 'pulpe-shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { DemoModeService } from './demo-mode.service';
import { type E2EWindow } from '@core/auth';

/**
 * Service responsible for initializing demo mode
 *
 * Creates an ephemeral demo session by calling the backend endpoint
 * and storing the returned JWT tokens in Supabase client
 */
@Injectable({
  providedIn: 'root',
})
export class DemoInitializerService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #authSession = inject(AuthSessionService);
  readonly #demoModeService = inject(DemoModeService);

  readonly #isInitializing = signal(false);
  readonly isInitializing = this.#isInitializing.asReadonly();

  /**
   * Start a demo session
   *
   * Process:
   * 1. Call backend /api/v1/demo/session endpoint with Turnstile token
   * 2. Store returned JWT session in Supabase client
   * 3. Set demo mode flag in localStorage
   * 4. Redirect to dashboard
   *
   * @param turnstileToken - Cloudflare Turnstile response token for anti-bot verification
   */
  async startDemoSession(turnstileToken: string): Promise<void> {
    // E2E Test Bypass - skip Turnstile & backend call
    if (
      typeof window !== 'undefined' &&
      (window as E2EWindow).__E2E_DEMO_BYPASS__ === true
    ) {
      await this.#handleE2EDemoBypass();
      return;
    }

    if (this.#isInitializing()) {
      this.#logger.warn('Demo session initialization already in progress');
      return;
    }

    this.#isInitializing.set(true);

    try {
      this.#logger.info('Starting demo session...');

      // Call backend to create demo user and session with Turnstile token
      const backendUrl = this.#config.backendApiUrl();
      const payload: DemoSessionCreate = { turnstileToken };
      const response = await firstValueFrom(
        this.#http
          .post<unknown>(`${backendUrl}/demo/session`, payload)
          .pipe(map((data) => demoSessionResponseSchema.parse(data))),
      );

      const session = response.data.session;

      this.#logger.info('Demo session created', {
        userId: session.user.id,
        email: session.user.email,
      });

      // Set the session using AuthSessionService (centralized session management)
      const sessionResult = await this.#authSession.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (!sessionResult.success) {
        throw new Error(
          sessionResult.error || 'Failed to set authentication session',
        );
      }

      // Activate demo mode (manages localStorage via reactive signals)
      this.#demoModeService.activateDemoMode(session.user.email);

      this.#logger.info('Demo mode activated successfully');

      // Redirect to dashboard
      await this.#router.navigate([ROUTES.APP, ROUTES.CURRENT_MONTH]);
    } catch (error) {
      this.#logger.error('Failed to start demo session', { error });

      // Provide specific error messages based on error type
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          throw new Error(
            'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
          );
        } else if (error.status >= 500) {
          throw new Error(
            'Le serveur rencontre un problème. Veuillez réessayer dans quelques instants.',
          );
        } else if (error.status === 429) {
          throw new Error(
            'Trop de tentatives. Veuillez patienter avant de réessayer.',
          );
        }
      }

      // Re-throw original error for other cases
      throw error;
    } finally {
      this.#isInitializing.set(false);
    }
  }

  /**
   * Exit demo mode and sign out the user
   */
  async exitDemoMode(): Promise<void> {
    this.#demoModeService.deactivateDemoMode();
    await this.#authSession.signOut();
    this.#logger.info('Demo mode exited and user signed out');
  }

  /**
   * Handle E2E test bypass
   *
   * Used by E2E tests to skip Turnstile verification and backend demo session creation.
   * Directly sets a mock session and navigates to dashboard.
   *
   * @private
   */
  async #handleE2EDemoBypass(): Promise<void> {
    const mockSession = (
      window as {
        __E2E_DEMO_SESSION__?: {
          user: { id: string; email: string };
          access_token: string;
          refresh_token: string;
        };
      }
    ).__E2E_DEMO_SESSION__;

    if (!mockSession) {
      this.#logger.error('E2E bypass enabled but no mock session found');
      throw new Error('E2E bypass configuration error');
    }

    this.#logger.info('🎭 E2E Demo Bypass: Skipping Turnstile & backend');

    // Auth state is already mocked by __E2E_AUTH_BYPASS__ via setupAuthBypass()
    // No need to call setSession() - it would attempt a real Supabase call and fail

    // Activate demo mode
    this.#demoModeService.activateDemoMode(mockSession.user.email);

    this.#logger.info('E2E Demo mode activated successfully');

    // Navigate to dashboard
    await this.#router.navigate([ROUTES.APP, ROUTES.CURRENT_MONTH]);
  }
}
