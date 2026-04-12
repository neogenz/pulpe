import {
  Injectable,
  inject,
  effect,
  computed,
  type EffectRef,
  type OnDestroy,
} from '@angular/core';
import { ANALYTICS_PROPERTIES } from 'pulpe-shared';
import { AuthStateService } from '../auth/auth-state.service';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import type { Properties } from 'posthog-js';

/**
 * Simplified analytics service following KISS principle.
 * Leverages PostHog's auto-capture for most tracking needs.
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService implements OnDestroy {
  readonly #authState = inject(AuthStateService);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);
  readonly #demoModeService = inject(DemoModeService);

  // Track if we've already enabled tracking for the current session
  #trackingEnabledForSession = false;

  // Track the auth synchronization effect to ensure idempotency
  #authEffect?: EffectRef;

  /**
   * Check if analytics is active and ready
   */
  readonly isActive = computed(() => {
    return (
      this.#postHogService.isInitialized() && this.#postHogService.isEnabled()
    );
  });

  /**
   * Initialize analytics tracking.
   * Note: The effect created here is intentionally permanent for a root service
   * and will be cleaned up when the application shuts down.
   */
  initializeAnalyticsTracking(): void {
    if (this.#authEffect) {
      return;
    }

    try {
      this.#authEffect = effect(() => {
        const active = this.isActive();
        const authState = this.#authState.authState();

        if (active && authState.isAuthenticated && authState.user) {
          if (!this.#trackingEnabledForSession) {
            this.#postHogService.enableTracking();
            this.#trackingEnabledForSession = true;
            this.#logger.debug('PostHog tracking enabled for session');
          }

          // Identify user with demo mode + early adopter flags.
          // `early_adopter` drives the targeted rollout of gated features via
          // PostHog feature flag conditions (person property match).
          const isDemoMode = this.#demoModeService.isDemoMode();
          const identifyProperties: Properties = {
            [ANALYTICS_PROPERTIES.EARLY_ADOPTER]:
              this.#authState.isEarlyAdopter(),
            ...(isDemoMode && { is_demo: true }),
          };

          this.#postHogService.identify(authState.user.id, identifyProperties);
          this.#postHogService.capturePendingSignupCompleted();
          this.#logger.debug('User identified for analytics', {
            userId: authState.user.id,
            isDemoMode,
          });
        } else if (!authState.isAuthenticated && !authState.isLoading) {
          this.#postHogService.reset();
          this.#trackingEnabledForSession = false;
          this.#logger.debug('Analytics session reset');
        }
      });

      this.#logger.info('Analytics service initialized');
    } catch (error) {
      this.#logger.error('Failed to initialize analytics service', error);
    }
  }

  /**
   * Capture event - PostHog handles data sanitization automatically
   */
  captureEvent(event: string, properties?: Properties): void {
    this.#postHogService.captureEvent(event, properties);
  }

  /**
   * Stop analytics tracking and clean up resources.
   * Exposed for deterministic cleanup in tests and for lifecycle hooks.
   */
  destroy(): void {
    this.#authEffect?.destroy();
    this.#authEffect = undefined;
    this.#trackingEnabledForSession = false;
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
