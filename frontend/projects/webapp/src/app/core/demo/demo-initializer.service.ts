import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { createClient } from '@supabase/supabase-js';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';

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
        this.#http.post<DemoSessionResponse>(
          `${backendUrl}/api/v1/demo/session`,
          {},
        ),
      );

      if (!response.success || !response.data.session) {
        throw new Error('Invalid demo session response from backend');
      }

      const session = response.data.session;

      this.#logger.info('Demo session created', {
        userId: session.user.id,
        email: session.user.email,
      });

      // Initialize Supabase client and set the session
      const supabaseUrl = this.#config.supabaseUrl();
      const supabaseKey = this.#config.supabaseAnonKey();

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Set the session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (sessionError) {
        throw new Error(
          `Failed to set Supabase session: ${sessionError.message}`,
        );
      }

      // Mark demo mode as active in localStorage
      localStorage.setItem('pulpe-demo-mode', 'true');
      localStorage.setItem('pulpe-demo-user-email', session.user.email);

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
   * Check if currently in demo mode
   */
  isDemoMode(): boolean {
    return localStorage.getItem('pulpe-demo-mode') === 'true';
  }

  /**
   * Exit demo mode (clears flags, but user remains logged in until session expires)
   */
  exitDemoMode(): void {
    localStorage.removeItem('pulpe-demo-mode');
    localStorage.removeItem('pulpe-demo-user-email');
    this.#logger.info('Demo mode exited');
  }
}
