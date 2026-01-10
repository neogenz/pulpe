import type { StorageKey } from './storage.service';

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
  // Budget
  CURRENT_BUDGET: 'pulpe-current-budget',

  // Demo mode
  DEMO_MODE: 'pulpe-demo-mode',
  DEMO_USER_EMAIL: 'pulpe-demo-user-email',

  // Product tours
  TOUR_INTRO: 'pulpe-tour-intro',
  TOUR_CURRENT_MONTH: 'pulpe-tour-current-month',
  TOUR_BUDGET_LIST: 'pulpe-tour-budget-list',
  TOUR_BUDGET_DETAILS: 'pulpe-tour-budget-details',
  TOUR_TEMPLATES_LIST: 'pulpe-tour-templates-list',
} as const satisfies Record<string, StorageKey>;
