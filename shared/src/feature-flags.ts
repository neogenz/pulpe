/**
 * PostHog person property keys pushed at `identify` time.
 *
 * Used for feature flag targeting, dashboard cohort filters, and surfacing
 * persons by human-readable identifiers (email/name) in the PostHog UI
 * instead of raw `person.id`.
 *
 * Must stay in sync with iOS `AnalyticsService` static property keys and the
 * property names referenced in PostHog dashboard flag conditions. Adding a
 * key here does NOT auto-add it on iOS — keep `AnalyticsService.swift` in sync.
 */
export const ANALYTICS_PROPERTIES = {
  /** Mirrors Supabase `auth.users.app_metadata.early_adopter`. */
  EARLY_ADOPTER: 'early_adopter',
  /** User's selected display currency (`'CHF' | 'EUR'`). */
  CURRENCY: 'currency',
  /** Whether the per-amount currency selector input is enabled. */
  SHOW_CURRENCY_SELECTOR: 'show_currency_selector',
  /** User's email — pushed at identify so PostHog UI shows persons by email. */
  EMAIL: 'email',
  /** User's display name (firstName from Supabase user_metadata). */
  NAME: 'name',
  /** Supabase auth.users.id — kept as person property in addition to being the distinct_id, so it's filterable in PostHog dashboards. */
  SUPABASE_USER_ID: 'supabase_user_id',
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
