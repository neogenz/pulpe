import {
  Service,
  inject,
  effect,
  computed,
  signal,
  type EffectRef,
  type OnDestroy,
} from '@angular/core';
import { ANALYTICS_PROPERTIES, type AnalyticsEventName } from 'pulpe-shared';
import { AuthStore } from '../auth/auth-store';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import type { CaptureOptions, Properties } from 'posthog-js';

// Trim + reject empty so re-identify can't overwrite a known-good
// email/name with `undefined` (posthog-js serializes that as null).
function pickNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Simplified analytics service following KISS principle.
 * Leverages PostHog's auto-capture for most tracking needs.
 */
@Service()
export class AnalyticsService implements OnDestroy {
  readonly #authStore = inject(AuthStore);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);
  readonly #demoModeService = inject(DemoModeService);
  readonly #userSettingsStore = inject(UserSettingsStore);

  // Track if we've already enabled tracking for the current session
  #trackingEnabledForSession = false;

  // Tracks whether `identify(userId)` has fired this session. Person property
  // updates are gated on this flag — mirrors the iOS `isIdentified` guard.
  readonly #isIdentified = signal(false);

  // Track the auth synchronization effect to ensure idempotency
  #authEffect?: EffectRef;
  // Re-emits person properties when settings change post-identify
  #personPropertiesEffect?: EffectRef;

  /**
   * Check if analytics is active and ready
   */
  readonly isActive = computed(() => {
    return (
      this.#postHogService.isInitialized() &&
      this.#postHogService.isEnabled() &&
      this.#postHogService.diagnosticSharingEnabled()
    );
  });
  readonly diagnosticSharingEnabled =
    this.#postHogService.diagnosticSharingEnabled;

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

          // Identify carries the user identity (email, name, supabase_user_id)
          // plus stable session flags (early adopter, demo). Settings are
          // pushed separately via `$set` from `#personPropertiesEffect` —
          // they are heavier signal deps that
          // would otherwise re-fire identify on every settings tick or PostHog
          // `flagsVersion` bump (feedback loop with this same identify call).
          const isDemoMode = this.#demoModeService.isDemoMode();
          const userMetadata = authState.user.user_metadata as
            | Record<string, unknown>
            | undefined;

          // Privacy policy commits to "prénom" only (legal/privacy-policy.ts).
          // iOS pushes user.firstName — keep webapp aligned. Do NOT fall back
          // to `full_name`/`name` from OAuth providers: Google returns the
          // full given+family name there, which would breach the policy.
          const firstName = pickNonEmptyString(userMetadata?.['firstName']);
          const userEmail = pickNonEmptyString(authState.user.email);

          const identifyProperties: Properties = {
            [ANALYTICS_PROPERTIES.SUPABASE_USER_ID]: authState.user.id,
            [ANALYTICS_PROPERTIES.EARLY_ADOPTER]:
              this.#authStore.isEarlyAdopter(),
            ...(userEmail && { [ANALYTICS_PROPERTIES.EMAIL]: userEmail }),
            ...(firstName && { [ANALYTICS_PROPERTIES.NAME]: firstName }),
            ...(isDemoMode && { is_demo: true }),
          };

          this.#postHogService.identify(authState.user.id, identifyProperties);
          this.#isIdentified.set(true);
          this.#postHogService.capturePendingSignupCompleted();
          this.#logger.debug('User identified for analytics', {
            userId: authState.user.id,
            isDemoMode,
          });
        } else if (
          !active ||
          (!authState.isAuthenticated && !authState.isLoading)
        ) {
          // Identity reset belongs to explicit logout or the local opt-out.
          this.#trackingEnabledForSession = false;
          this.#isIdentified.set(false);
        }
      });

      this.#personPropertiesEffect = effect(() => {
        const userSettings = this.#userSettingsStore.settings();

        if (userSettings) {
          this.#postHogService.setLocale(userSettings.locale);
        }

        // Skip until identify has fired and settings have actually loaded.
        // Without this guard a user with `currency = EUR` would briefly land
        // on the CHF cohort before the settings resource resolves.
        if (!this.#isIdentified() || !userSettings) {
          return;
        }

        this.#postHogService.setPersonProperties({
          [ANALYTICS_PROPERTIES.CURRENCY]: userSettings.currency,
          [ANALYTICS_PROPERTIES.SHOW_CURRENCY_SELECTOR]:
            userSettings.showCurrencySelector,
          [ANALYTICS_PROPERTIES.LOCALE]: userSettings.locale,
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
  captureEvent(
    event: AnalyticsEventName,
    properties?: Properties,
    options?: CaptureOptions,
  ): void {
    this.#postHogService.captureEvent(event, properties, options);
  }

  /**
   * Update person properties on the current PostHog profile via `$set`.
   * No-op until `identify(userId)` has fired this session — prevents leaking
   * preferences onto the anonymous person profile.
   */
  setPersonProperties(properties: Properties): void {
    if (!this.#isIdentified()) {
      return;
    }
    this.#postHogService.setPersonProperties(properties);
  }

  setLocale(locale: Parameters<PostHogService['setLocale']>[0]): void {
    this.#postHogService.setLocale(locale);
  }

  setDiagnosticSharingEnabled(enabled: boolean): void {
    this.#postHogService.setDiagnosticSharingEnabled(enabled);
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
    this.#isIdentified.set(false);
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
