/**
 * PostHog event properties with strict typing
 */
export interface PostHogEventProperties extends Record<string, unknown> {
  // Common properties for all events
  feature?: string;
  action?: string;
  value?: number;
  duration_ms?: number;

  // Error tracking properties
  error_code?: string;
  error_message?: string;
  error_source?: 'unhandled' | 'http' | 'user_action' | 'system';

  // Navigation properties
  from_page?: string;
  to_page?: string;

  // Business metrics
  budget_id?: string;
  template_id?: string;
  transaction_id?: string;
  amount?: number;
}

/**
 * User properties for identification
 */
export interface PostHogUserProperties {
  email?: string;
  created_at?: string;
  subscription_tier?: 'free' | 'premium' | 'enterprise';
  preferred_language?: 'fr' | 'en';
  onboarding_completed?: boolean;
  budgets_count?: number;
  templates_count?: number;
}

/**
 * Type-safe event names following naming conventions
 */
export const PostHogEvents = {
  // Page views
  PAGE_VIEW: 'page_view',
  PAGE_LEAVE: '$pageleave',

  // Authentication
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  SESSION_EXPIRED: 'session_expired',

  // Budget events
  BUDGET_CREATED: 'budget_created',
  BUDGET_UPDATED: 'budget_updated',
  BUDGET_DELETED: 'budget_deleted',

  // Template events
  TEMPLATE_CREATED: 'template_created',
  TEMPLATE_UPDATED: 'template_updated',
  TEMPLATE_DELETED: 'template_deleted',
  TEMPLATE_APPLIED: 'template_applied',

  // Transaction events
  TRANSACTION_ADDED: 'transaction_added',
  TRANSACTION_UPDATED: 'transaction_updated',
  TRANSACTION_DELETED: 'transaction_deleted',

  // Error events
  ERROR_OCCURRED: 'error_occurred',
  EXCEPTION_CAPTURED: '$exception',

  // Feature usage
  FEATURE_USED: 'feature_used',
  FEATURE_DISCOVERED: 'feature_discovered',

  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
} as const;

export type PostHogEventName =
  (typeof PostHogEvents)[keyof typeof PostHogEvents];

/**
 * PostHog configuration type
 */
export interface PostHogConfig {
  apiKey: string;
  apiHost?: string;
  enabled: boolean;
}
