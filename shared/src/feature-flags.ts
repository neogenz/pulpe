/**
 * PostHog feature flag keys — single source of truth.
 *
 * Add a new constant here before using a flag anywhere else. The key value
 * must exactly match the flag name configured in the PostHog dashboard.
 *
 * Flag lifecycle:
 * 1. Ship code gated on the flag (default: false)
 * 2. Enable via PostHog dashboard (targeted → progressive → 100%)
 * 3. Clean removal: delete the conditional + delete the constant below
 */
export const FEATURE_FLAGS = {
  /** Gates the multi-currency UX (CHF/EUR picker, conversion badges, currency settings). */
  MULTI_CURRENCY: 'multi-currency-enabled',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * PostHog person property keys used for feature flag targeting and dashboards.
 *
 * Must stay in sync with iOS `AnalyticsService` static property keys and the
 * property names referenced in PostHog dashboard flag conditions.
 */
export const ANALYTICS_PROPERTIES = {
  /** Mirrors Supabase `auth.users.app_metadata.early_adopter`. */
  EARLY_ADOPTER: 'early_adopter',
  /** User's selected display currency (`'CHF' | 'EUR'`). */
  CURRENCY: 'currency',
  /** Whether the per-amount currency selector input is enabled. */
  SHOW_CURRENCY_SELECTOR: 'show_currency_selector',
  /** Mirrors `multi-currency-enabled` flag exposure for dashboard cohort filters. */
  MULTI_CURRENCY_ENABLED: 'multi_currency_enabled',
} as const;

/**
 * PostHog event names — cross-platform source of truth (web + iOS).
 *
 * Event values follow `object_action` past-tense `snake_case`. iOS mirrors
 * via `AnalyticsEvent` raw values. Adding an event here does not auto-add it
 * on iOS — keep `AnalyticsEvent.swift` in sync.
 */
export const ANALYTICS_EVENTS = {
  /** Fires after a successful currency change in settings. Properties: `from`, `to`. */
  CURRENCY_CHANGED: 'currency_changed',
  /** Fires after a successful "Saisir dans une autre devise" toggle in settings. Properties: `enabled`. */
  CURRENCY_SELECTOR_TOGGLED: 'currency_selector_toggled',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
