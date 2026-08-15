import * as z from 'zod';
import {
  onboardingTransactionSchema,
  PAY_DAY_MAX,
  supportedCurrencySchema,
  supportedLocaleSchema,
} from 'pulpe-shared';
import { isValidClientKeyHex } from '../encryption/crypto.utils';
import { STORAGE_KEYS } from './storage-keys';
import type { StorageSchemaConfig } from './storage.types';

export const completeProfileDraftSchema = z.object({
  version: z.literal(1),
  currentStep: z.union([z.literal(1), z.literal(2)]),
  currency: supportedCurrencySchema,
  firstName: z.string().max(50).catch(''),
  monthlyIncome: z.number().finite().nonnegative().nullable().catch(null),
  housingCosts: z.number().finite().nonnegative().nullable().catch(null),
  healthInsurance: z.number().finite().nonnegative().nullable().catch(null),
  phonePlan: z.number().finite().nonnegative().nullable().catch(null),
  internetPlan: z.number().finite().nonnegative().nullable().catch(null),
  transportCosts: z.number().finite().nonnegative().nullable().catch(null),
  leasingCredit: z.number().finite().nonnegative().nullable().catch(null),
  payDayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(PAY_DAY_MAX)
    .nullable()
    .catch(null),
  customTransactions: z
    .array(
      onboardingTransactionSchema.extend({
        __suggestionId: z.string().min(1).optional(),
        id: z.string().min(1).optional(),
      }),
    )
    .max(50)
    .catch([]),
});

export type CompleteProfileDraft = z.infer<typeof completeProfileDraftSchema>;

/**
 * Schema registry for all storage keys.
 * Each key has a Zod schema, version number, and scope.
 *
 * ## Adding a new key:
 * 1. Add the key to STORAGE_KEYS in storage-keys.ts
 * 2. Define schema here with version: 1 and appropriate scope
 * 3. If modifying existing data shape, increment version and add migration
 *
 * ## Scope guide:
 * - 'user': Data specific to logged-in user (cleared on logout)
 * - 'app': Device/app settings (preserved across sessions)
 */
export const STORAGE_SCHEMAS = {
  [STORAGE_KEYS.DEMO_MODE]: {
    version: 2,
    schema: z.boolean(),
    scope: 'user',
  },

  [STORAGE_KEYS.DEMO_USER_EMAIL]: {
    version: 1,
    schema: z.string().email(),
    scope: 'user',
  },

  [STORAGE_KEYS.BUDGET_DESKTOP_VIEW]: {
    version: 1,
    schema: z.string(),
    scope: 'user',
  },

  [STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED]: {
    version: 1,
    schema: z.boolean(),
    scope: 'user',
  },

  [STORAGE_KEYS.DASHBOARD_OUTLOOK_EXPANDED]: {
    version: 1,
    schema: z.boolean(),
    scope: 'user',
  },

  [STORAGE_KEYS.DASHBOARD_POINTING_LEARNED]: {
    version: 1,
    schema: z.boolean(),
    scope: 'user',
  },

  // Currency snapshot for bootstrap locale selection (device-level, preserved across sessions)
  [STORAGE_KEYS.SETTINGS_CURRENCY]: {
    version: 1,
    schema: supportedCurrencySchema,
    scope: 'app',
  },

  // Language snapshot. Scope 'app' is load-bearing: under 'user' the key would
  // be purged on logout and the sign-in screen would fall back to French right
  // after someone chose another language.
  [STORAGE_KEYS.SETTINGS_LANGUAGE]: {
    version: 1,
    schema: supportedLocaleSchema,
    scope: 'app',
  },

  // Short-lived onboarding recovery. Financial drafts must never persist
  // beyond the current browser session.
  [STORAGE_KEYS.COMPLETE_PROFILE_DRAFT]: {
    version: 1,
    schema: completeProfileDraftSchema,
    scope: 'user',
    storageType: 'session',
  },

  // Vault client keys - hex string representing the AES-256 key
  // Session storage is cleared when tab closes, local persists with "remember device"
  [STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION]: {
    version: 1,
    schema: z.string().refine(isValidClientKeyHex, {
      message: 'Invalid client key hex format',
    }),
    scope: 'user',
    storageType: 'session',
  },
  [STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL]: {
    version: 1,
    schema: z.string().refine(isValidClientKeyHex, {
      message: 'Invalid client key hex format',
    }),
    scope: 'app',
    storageType: 'local',
  },

  // Vault key validation cache — timestamp of last server validation (session-scoped)
  [STORAGE_KEYS.VAULT_KEY_VALIDATED_AT]: {
    version: 1,
    schema: z.number().int().positive(),
    scope: 'user',
    storageType: 'session',
  },

  // What's New - tracks last dismissed version (device-level, preserved across sessions)
  [STORAGE_KEYS.WHATS_NEW_DISMISSED]: {
    version: 1,
    schema: z.string(),
    scope: 'app',
  },

  // Dev-only manual feature-flag override map (device-level, dev environments only)
  [STORAGE_KEYS.DEV_FEATURE_FLAGS]: {
    version: 1,
    schema: z.record(z.string(), z.boolean()),
    scope: 'app',
  },
} as const satisfies Record<string, StorageSchemaConfig>;

/**
 * Schema config for dynamic tour keys (pulpe-tour-*).
 * Tours are device-scoped and preserved across sessions.
 */
export const TOUR_SCHEMA_CONFIG: StorageSchemaConfig<string> = {
  version: 1,
  schema: z.string(),
  scope: 'app',
};

/**
 * Get schema config for a storage key.
 * Handles both static keys and dynamic tour keys.
 */
export function getSchemaConfig(key: string): StorageSchemaConfig | undefined {
  if (key in STORAGE_SCHEMAS) {
    return STORAGE_SCHEMAS[key as keyof typeof STORAGE_SCHEMAS];
  }

  if (key.startsWith('pulpe-tour-')) {
    return TOUR_SCHEMA_CONFIG;
  }

  return undefined;
}

export type StorageSchemasType = typeof STORAGE_SCHEMAS;
