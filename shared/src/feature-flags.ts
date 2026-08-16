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
  /**
   * User's interface language (`'fr' | 'en' | 'de' | 'it'`). Pushed with `$set`
   * from the settings observer, never from `identify`. Segments every existing
   * funnel by language — which is the whole point of measuring the translations.
   */
  LOCALE: 'locale',
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
  /** Fires when the iOS app enters the foreground. Properties: none. */
  APP_OPENED: 'app_opened',
  /** Fires when the welcome screen is rendered. Properties: none. */
  WELCOME_VIEWED: 'welcome_viewed',
  /** Fires after the web demo session starts. Properties: none. */
  DEMO_STARTED: 'demo_started',
  /** Fires when the multi-step onboarding begins. Properties: `method` on iOS. */
  ONBOARDING_STARTED: 'onboarding_started',
  /** Fires when registration begins. Properties: `method`. */
  SIGNUP_STARTED: 'signup_started',
  /** Fires after registration succeeds. Properties: `method`. */
  SIGNUP_COMPLETED: 'signup_completed',
  /** Fires after registration fails. Properties: `method`, `error_kind`, `error_message`. */
  SIGNUP_FAILED: 'signup_failed',
  /** Fires after an onboarding step. Properties: `step`, optional `skipped`, `step_index`, `step_total`, `auth_method`. */
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  /** Fires when onboarding is exited early. Properties: `last_step`, `exit_method`, `was_authenticated`, `auth_method`. */
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  /** Fires when an incomplete signup resumes. Properties: `method`, `source`, `resumed_at_step`. */
  ONBOARDING_RESUMED: 'onboarding_resumed',
  /** Fires when an onboarding suggestion changes. Properties: `step`, `suggestion_name`, `selected`. */
  ONBOARDING_SUGGESTION_TOGGLED: 'onboarding_suggestion_toggled',
  /** Fires when a custom onboarding row is added. Properties: `step`, `kind`, `source`. */
  CUSTOM_TRANSACTION_ADDED: 'custom_transaction_added',
  /** Fires when a custom onboarding row is removed. Properties: `step`, `kind`, `source`. */
  CUSTOM_TRANSACTION_REMOVED: 'custom_transaction_removed',
  /** Fires after the initial budget is created. Properties: `signup_method`, `has_pay_day`, `charges_count`, `custom_transactions_count`. */
  FIRST_BUDGET_CREATED: 'first_budget_created',
  /** Fires after login succeeds. Properties: `method`. */
  LOGIN_COMPLETED: 'login_completed',
  /** Fires after login fails. Properties: `method`, `error_kind`, `error_message`. */
  LOGIN_FAILED: 'login_failed',
  /** Fires when startup session restoration fails. Properties: `method`, `error_kind`, `error_message`. */
  SESSION_RESTORE_FAILED: 'session_restore_failed',
  /** Fires for iOS auth lifecycle diagnostics. Properties: `source`, `outcome`, optional diagnostic context. */
  AUTH_SESSION_OBSERVED: 'auth_session_observed',
  /** Fires after logout completes. Properties: `source`. */
  LOGOUT_COMPLETED: 'logout_completed',
  /** Fires after PIN creation succeeds. Properties: none. */
  PIN_SETUP_COMPLETED: 'pin_setup_completed',
  /** Fires after an existing PIN is accepted. Properties: none. */
  PIN_ENTERED: 'pin_entered',
  /** Fires after an existing PIN is changed. Properties: none. */
  PIN_CHANGED: 'pin_changed',
  /** Fires when a budget is created outside onboarding. Properties: none. */
  BUDGET_CREATED: 'budget_created',
  /** Fires after a transaction is created. Properties: `type`. */
  TRANSACTION_CREATED: 'transaction_created',
  /** Fires when the active tab changes. Properties: `tab`. */
  TAB_SWITCHED: 'tab_switched',
  /** Fires when the notification pre-permission prompt appears. Properties: none. */
  NOTIFICATION_PRIME_SHOWN: 'notification_prime_shown',
  /** Fires when notification permission is granted. Properties: none. */
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  /** Fires when notification permission is denied. Properties: none. */
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
  /** Fires when the reminders preference changes. Properties: `enabled`. */
  REMINDER_TOGGLED: 'reminder_toggled',
  /** Fires when iOS release notes are shown after an update. Properties: `version`. */
  IOS_WHATS_NEW_SHOWN: 'ios_whats_new_shown',
  /** Fires after a successful currency change in settings. Properties: `from`, `to`. */
  CURRENCY_CHANGED: 'currency_changed',
  /** Fires after a successful "Saisir dans une autre devise" toggle in settings. Properties: `enabled`. */
  CURRENCY_SELECTOR_TOGGLED: 'currency_selector_toggled',
  /** Fires after all onboarding currency persistence retries fail. Properties: `currency`, `attempts`. */
  CURRENCY_PERSIST_FAILED: 'currency_persist_failed',
  /**
   * Fires after a successful interface language change. Properties: `from`,
   * `to` (both `'fr' | 'en' | 'de' | 'it'`), `surface`
   * (`'settings' | 'welcome' | 'landing'`). The `locale` person property is
   * last-write-wins and never shows the transition — this event is the only
   * place a wrong auto-detection ("40% of detected `de` switch back to `fr`")
   * is visible.
   */
  LANGUAGE_CHANGED: 'language_changed',
  /** Fires when the savings-goals first-run intro opens. Properties: none. */
  SAVINGS_GOALS_INTRO_VIEWED: 'savings_goals_intro_viewed',
  /** Fires when the savings-goals intro creates its first goal. Properties: none. */
  SAVINGS_GOALS_INTRO_COMPLETED: 'savings_goals_intro_completed',
  /** Fires when the savings-goals intro is skipped. Properties: none. */
  SAVINGS_GOALS_INTRO_SKIPPED: 'savings_goals_intro_skipped',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
