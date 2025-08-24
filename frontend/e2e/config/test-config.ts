/**
 * Centralized test configuration
 * All test data and credentials in one place
 */

// Security check: Only allow in test environments
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  throw new Error('Test configuration cannot be loaded in production environment');
}

export const TEST_CONFIG = {
  // User credentials (can be overridden by environment variables)
  USER: {
    ID: process.env.E2E_TEST_USER_ID || 'e2e-test-user-' + Date.now(),
    EMAIL: process.env.E2E_TEST_EMAIL || `e2e-test-${Date.now()}@pulpe.local`,
    PASSWORD: process.env.E2E_TEST_PASSWORD || 'E2E-Test-Pass-123!'
  },
  
  // Auth tokens
  TOKENS: {
    ACCESS: process.env.E2E_ACCESS_TOKEN || `mock-access-token-${Date.now()}`,
    REFRESH: process.env.E2E_REFRESH_TOKEN || `mock-refresh-token-${Date.now()}`
  },
  
  // Test data
  BUDGETS: {
    CURRENT_MONTH: {
      id: 'e2e-budget-current',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      total_income: 5000,
      total_expenses: 3000,
      available_to_spend: 2000
    }
  },
  
  TEMPLATES: {
    DEFAULT: {
      id: 'e2e-template-default',
      name: 'E2E Test Template',
      is_default: true
    }
  }
} as const;

// Type exports for type safety
export type TestUser = typeof TEST_CONFIG.USER;
export type TestTokens = typeof TEST_CONFIG.TOKENS;
export type TestBudget = typeof TEST_CONFIG.BUDGETS.CURRENT_MONTH;
export type TestTemplate = typeof TEST_CONFIG.TEMPLATES.DEFAULT;