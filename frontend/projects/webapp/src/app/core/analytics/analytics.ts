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

  // Tracks whether `identify(userId)` has fired this session. Person property
  // updates are gated on this flag — mirrors the iOS `isIdentified` guard.
  #isIdentified = false;

  // Track the auth synchronization effect to ensure idempotency
  #authEffect?: EffectRef;
  // Re-emits person properties when settings or flag exposure change post-identify
  #personPropertiesEffect?: EffectRef;

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

          // Identify carries demo + early adopter flags only. Settings + the
          // multi-currency flag are pushed separately via `$set` from
          // `#personPropertiesEffect` — they are heavier signal deps that
          // would otherwise re-fire identify on every settings tick or PostHog
          // `flagsVersion` bump (feedback loop with this same identify call).
          const isDemoMode = this.#demoModeService.isDemoMode();
          const identifyProperties: Properties = {
            [ANALYTICS_PROPERTIES.EARLY_ADOPTER]:
              this.#authStore.isEarlyAdopter(),
            ...(isDemoMode && { is_demo: true }),
          };

          this.#postHogService.identify(authState.user.id, identifyProperties);
          this.#isIdentified = true;
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
          this.#isIdentified = false;
        }
      });

      this.#personPropertiesEffect = effect(() => {
        const userSettings = this.#userSettingsStore.settings();
        const isMultiCurrencyEnabled =
          this.#featureFlagsService.isMultiCurrencyEnabled();

        // Skip until identify has fired and settings have actually loaded.
        // Without this guard a user with `currency = EUR` would briefly land
        // on the CHF cohort before the settings resource resolves.
        if (!this.#isIdentified || !userSettings) {
          return;
        }

        this.#postHogService.setPersonProperties({
          [ANALYTICS_PROPERTIES.CURRENCY]: userSettings.currency,
          [ANALYTICS_PROPERTIES.SHOW_CURRENCY_SELECTOR]:
            userSettings.showCurrencySelector,
          [ANALYTICS_PROPERTIES.MULTI_CURRENCY_ENABLED]: isMultiCurrencyEnabled,
        });
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
   * Update person properties on the current PostHog profile via `$set`.
   * No-op until `identify(userId)` has fired this session — prevents leaking
   * preferences onto the anonymous person profile.
   */
  setPersonProperties(properties: Properties): void {
    if (!this.#isIdentified) {
      return;
    }
    this.#postHogService.setPersonProperties(properties);
  }

  /**
   * Stop analytics tracking and clean up resources.
   * Exposed for deterministic cleanup in tests and for lifecycle hooks.
   */
  destroy(): void {
    this.#authEffect?.destroy();
    this.#authEffect = undefined;
    this.#personPropertiesEffect?.destroy();
    this.#personPropertiesEffect = undefined;
    this.#trackingEnabledForSession = false;
    this.#isIdentified = false;
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
