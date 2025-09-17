import {
  Injectable,
  inject,
  effect,
  computed,
  type EffectRef,
} from '@angular/core';
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

  initialize(): void {
    // Ensure we only create the effect once (idempotent)
    if (this.#authEffect) {
      return;
    }

    // Create a reactive effect that responds to both PostHog state and auth state
    this.#authEffect = effect(() => {
      const active = this.isActive();
      const authState = this.#authApi.authState();

      // Only proceed if PostHog is active
      if (active && authState.isAuthenticated && authState.user) {
        // Only enable tracking once per session to avoid redundant calls
        // Safe because users must have accepted terms to have an account
        if (!this.#trackingEnabledForSession) {
          this.#postHogService.enableTracking();
          this.#trackingEnabledForSession = true;
          this.#logger.debug('PostHog tracking enabled for session');
        }
        this.#postHogService.identify(authState.user.id);
        this.#logger.debug('User identified for analytics');
      } else if (!authState.isAuthenticated && !authState.isLoading) {
        this.#postHogService.reset();
        this.#trackingEnabledForSession = false; // Reset flag on logout
        this.#logger.debug('Analytics session reset');
      }
    });

    this.#logger.info('Analytics service initialized');
  }

  /**
   * Track custom business events
   *
   * IMPORTANT: PostHog Philosophy for Financial Apps
   * ==============================================
   *
   * ✅ DO track behavioral events:
   * - User actions: 'transaction_created', 'budget_updated', 'export_clicked'
   * - User flows: 'onboarding_completed', 'settings_opened'
   * - Feature usage: 'template_applied', 'category_selected'
   * - System events: 'sync_completed', 'error_occurred'
   *
   * ❌ DO NOT track financial amounts:
   * - Exact amounts: { amount: 1500.50 }
   * - Account balances: { balance: 25000 }
   * - Transaction totals: { total: 999.99 }
   *
   * ✅ If needed, use categories instead:
   * - { transaction_type: 'large' } instead of { amount: 5000 }
   * - { budget_status: 'over_limit' } instead of { remaining: -200 }
   * - { account_type: 'savings' } instead of { balance: 15000 }
   *
   * Rationale:
   * - PostHog is for behavioral analytics, not financial data storage
   * - Impossible to distinguish amounts vs IDs/years without context
   * - Simpler, more secure, and privacy-compliant approach
   */
  track(event: string, properties?: Record<string, unknown>): void {
    // Let PostHogService handle all gating logic via #canCapture()
    this.#postHogService.capture(event, properties);
  }
}
