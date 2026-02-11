import { z } from 'zod';
import { isValidClientKeyHex } from '../encryption/crypto.utils';
import { STORAGE_KEYS } from './storage-keys';
import type { StorageSchemaConfig } from './storage.types';

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
    scope: 'user',
    storageType: 'local',
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
