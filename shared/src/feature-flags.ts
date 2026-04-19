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
 * PostHog person property keys used for feature flag targeting.
 *
 * Mirrors Supabase `auth.users.app_metadata` keys. Must stay in sync with
 * the iOS `AnalyticsService.earlyAdopterProperty` constant and the property
 * names referenced in PostHog dashboard flag conditions.
 */
export const ANALYTICS_PROPERTIES = {
  EARLY_ADOPTER: 'early_adopter',
} as const;
