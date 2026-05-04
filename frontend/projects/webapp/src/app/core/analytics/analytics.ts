import {
  Injectable,
  inject,
  effect,
  computed,
  type EffectRef,
  type OnDestroy,
} from '@angular/core';
import { ANALYTICS_PROPERTIES } from 'pulpe-shared';
import { AuthStore } from '../auth/auth-store';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import type { Properties } from 'posthog-js';

/**
 * Simplified analytics service following KISS principle.
 * Leverages PostHog's auto-capture for most tracking needs.
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService implements OnDestroy {
  readonly #authStore = inject(AuthStore);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);
  readonly #demoModeService = inject(DemoModeService);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #featureFlagsService = inject(FeatureFlagsService);

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
        const authState = this.#authStore.authState();

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
          const userSettings = this.#userSettingsStore.settings();
          const isMultiCurrencyEnabled =
            this.#featureFlagsService.isMultiCurrencyEnabled();
          const identifyProperties: Properties = {
            [ANALYTICS_PROPERTIES.EARLY_ADOPTER]:
              this.#authStore.isEarlyAdopter(),
            [ANALYTICS_PROPERTIES.CURRENCY]: userSettings?.currency ?? 'CHF',
            [ANALYTICS_PROPERTIES.SHOW_CURRENCY_SELECTOR]:
              userSettings?.showCurrencySelector ?? false,
            [ANALYTICS_PROPERTIES.MULTI_CURRENCY_ENABLED]:
              isMultiCurrencyEnabled,
            ...(isDemoMode && { is_demo: true }),
          };

          this.#postHogService.identify(authState.user.id, identifyProperties);
          this.#postHogService.capturePendingSignupCompleted();
          this.#logger.debug('User identified for analytics', {
            userId: authState.user.id,
            isDemoMode,
          });
        } else if (!authState.isAuthenticated && !authState.isLoading) {
          // Do NOT call posthog.reset() on every anonymous tick: it would
          // destroy the distinct_id bootstrapped from the landing via ?ph_did=
          // and wipe registered super properties (platform, environment, app_version).
          // reset() belongs in the explicit signOut flow; see AuthStore.
          this.#trackingEnabledForSession = false;
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
   * Update person properties on the current PostHog profile.
   * Use after a user action that mutates a tracked property
   * (e.g., currency change in settings) so dashboards reflect the new state.
   */
  setPersonProperties(properties: Properties): void {
    this.#postHogService.setPersonProperties(properties);
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
