import type { SupportedCurrency } from 'pulpe-shared';

/**
 * Domain entity representing the public-facing profile derived from
 * Supabase auth user metadata. All fields are camelCase plain values.
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Domain entity representing the user's settings persisted in
 * `auth.users.user_metadata`.
 */
export interface UserSettings {
  payDayOfMonth: number | null;
  currency: SupportedCurrency;
  showCurrencySelector: boolean;
}

/**
 * Patch applied when updating the user's name in `auth.users.user_metadata`.
 */
export interface UpdateUserProfileInput {
  firstName: string;
  lastName: string;
}

/**
 * Partial patch applied when updating the user's settings in
 * `auth.users.user_metadata`. Fields left undefined are not modified;
 * `payDayOfMonth: null` clears the value explicitly.
 */
export interface UpdateUserSettingsInput {
  payDayOfMonth?: number | null;
  currency?: SupportedCurrency;
  showCurrencySelector?: boolean;
}

/**
 * Outcome of scheduling an account deletion. `alreadyScheduled` is true when
 * the user already had a `scheduledDeletionAt` value at request time
 * (idempotent path — no DB write occurred).
 */
export interface ScheduledAccountDeletion {
  scheduledDeletionAt: string;
  alreadyScheduled: boolean;
}
