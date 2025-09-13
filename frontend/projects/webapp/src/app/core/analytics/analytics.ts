import { Injectable, inject, effect, computed } from '@angular/core';
import { AuthApi } from '../auth/auth-api';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';

/**
 * Simplified analytics service following KISS principle.
 * Leverages PostHog's auto-capture for most tracking needs.
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  readonly #authApi = inject(AuthApi);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);

  /**
   * Check if analytics is active and ready
   */
  readonly isActive = computed(() => {
    return (
      this.#postHogService.isInitialized() && this.#postHogService.isEnabled()
    );
  });

  initialize(): void {
    if (!this.#postHogService.isInitialized()) {
      return;
    }

    // Auto-identify users when auth state changes
    effect(() => {
      const authState = this.#authApi.authState();
      if (authState.isAuthenticated && authState.user) {
        this.#postHogService.identify(authState.user.id);
        this.#logger.debug('User identified for analytics');
      } else if (!authState.isAuthenticated && !authState.isLoading) {
        this.#postHogService.reset();
        this.#logger.debug('Analytics session reset');
      }
    });

    this.#logger.info('Analytics service initialized');
  }

  /**
   * Track custom business events
   */
  track(event: string, properties?: Record<string, unknown>): void {
    if (this.#postHogService.isInitialized()) {
      this.#postHogService.capture(event, properties);
    }
  }
}
