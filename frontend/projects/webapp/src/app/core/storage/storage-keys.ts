import type { StorageKey } from './storage.types';

/**
 * Centralized storage keys for the application.
 * All keys MUST use the 'pulpe-' or 'pulpe_' prefix.
 *
 * Add new keys here to ensure they are:
 * 1. Type-checked at compile time
 * 2. Cleaned on user logout
 * 3. Easy to find and maintain
 */
export const STORAGE_KEYS = {
  // Demo mode
  DEMO_MODE: 'pulpe-demo-mode',
  DEMO_USER_EMAIL: 'pulpe-demo-user-email',

  // Budget UI preferences
  BUDGET_DESKTOP_VIEW: 'pulpe-budget-desktop-view',
  BUDGET_SHOW_ONLY_UNCHECKED: 'pulpe-budget-show-only-unchecked',

  // Vault/Client key - stores encrypted client key for vault access
  VAULT_CLIENT_KEY_SESSION: 'pulpe-vault-client-key-session',
  VAULT_CLIENT_KEY_LOCAL: 'pulpe-vault-client-key-local',

  // Vault key validation cache (sessionStorage)
  VAULT_KEY_VALIDATED_AT: 'pulpe-vault-key-validated-at',

  // What's New dismissal
  WHATS_NEW_DISMISSED: 'pulpe-whats-new-dismissed',

  // Analytics: pending OAuth signup method (sessionStorage)
  PENDING_SIGNUP_METHOD: 'pulpe_pending_signup_method',

  // Page lifecycle recovery: reload cooldown timestamp (sessionStorage)
  PAGE_RELOAD_COOLDOWN: 'pulpe-page-reload-cooldown-at',
} as const satisfies Record<string, StorageKey>;
