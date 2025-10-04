import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { AuthApi } from '@core/auth/auth-api';
import { DemoModeService } from './demo-mode.service';

interface DemoSessionResponse {
  success: true;
  data: {
    session: {
      access_token: string;
      token_type: string;
      expires_in: number;
      expires_at: number;
      refresh_token: string;
      user: {
        id: string;
        email: string;
        created_at: string;
      };
    };
  };
  message: string;
}

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
  readonly #authApi = inject(AuthApi);
  readonly #demoModeService = inject(DemoModeService);

  readonly #isInitializing = signal(false);
  readonly isInitializing = this.#isInitializing.asReadonly();

  /**
   * Start a demo session
   *
   * Process:
   * 1. Call backend /api/v1/demo/session endpoint
   * 2. Store returned JWT session in Supabase client
   * 3. Set demo mode flag in localStorage
   * 4. Redirect to dashboard
   */
  async startDemoSession(): Promise<void> {
    if (this.#isInitializing()) {
      this.#logger.warn('Demo session initialization already in progress');
      return;
    }

    this.#isInitializing.set(true);

    try {
      this.#logger.info('Starting demo session...');

      // Call backend to create demo user and session
      const backendUrl = this.#config.backendApiUrl();
      const response = await firstValueFrom(
        this.#http.post<DemoSessionResponse>(`${backendUrl}/demo/session`, {}),
      );

      if (!response.success || !response.data.session) {
        throw new Error('Invalid demo session response from backend');
      }

      const session = response.data.session;

      this.#logger.info('Demo session created', {
        userId: session.user.id,
        email: session.user.email,
      });

      // Set the session using AuthApi (centralized session management)
      const sessionResult = await this.#authApi.setSession({
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
      await this.#router.navigate([ROUTES.CURRENT_MONTH]);
    } catch (error) {
      this.#logger.error('Failed to start demo session', { error });
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
    await this.#authApi.signOut();
    this.#logger.info('Demo mode exited and user signed out');
  }
}
