/**
 * Centralized test configuration
 * All test data and credentials in one place
 *
 * IMPORTANT: All IDs must be valid UUIDs to pass Zod runtime validation.
 * Using static UUIDs ensures consistency across test runs.
 */

// Security check: Only allow in test environments
if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') {
  throw new Error('Test configuration cannot be loaded in production environment');
}

// Static UUIDs for test consistency (matches helpers/api-mocks.ts TEST_UUIDS)
const TEST_USER_ID =
  process.env['E2E_TEST_USER_ID'] ||
  '00000000-0000-4000-a000-000000000201';
const TEST_TEMPLATE_ID = '00000000-0000-4000-a000-000000000101';
const TEST_BUDGET_ID = '00000000-0000-4000-a000-000000000001';

const now = new Date().toISOString();
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export const TEST_CONFIG = {
  // User credentials (can be overridden by environment variables)
  USER: {
    ID: TEST_USER_ID,
    EMAIL: process.env['E2E_TEST_EMAIL'] || 'e2e-test@pulpe.local',
    PASSWORD: process.env['E2E_TEST_PASSWORD'] || 'E2E-Test-Pass-123!',
  },

  // Auth tokens (static for test consistency)
  TOKENS: {
    ACCESS:
      process.env['E2E_ACCESS_TOKEN'] || 'mock-access-token-e2e-static',
    REFRESH:
      process.env['E2E_REFRESH_TOKEN'] || 'mock-refresh-token-e2e-static',
  },

  // Test data - follows budgetSchema from shared/schemas.ts
  BUDGETS: {
    CURRENT_MONTH: {
      id: TEST_BUDGET_ID,
      userId: TEST_USER_ID,
      templateId: TEST_TEMPLATE_ID,
      month: currentMonth,
      year: currentYear,
      description: 'E2E Test Budget',
      endingBalance: 0,
      rollover: 0,
      remaining: 2000,
      createdAt: now,
      updatedAt: now,
    },
  },

  TEMPLATES: {
    DEFAULT: {
      id: TEST_TEMPLATE_ID,
      name: 'E2E Test Template',
      description: 'Default test template for E2E testing',
      userId: TEST_USER_ID,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  },
} as const;

// Type exports for type safety
export type TestUser = typeof TEST_CONFIG.USER;
export type TestTokens = typeof TEST_CONFIG.TOKENS;
export type TestBudget = typeof TEST_CONFIG.BUDGETS.CURRENT_MONTH;
export type TestTemplate = typeof TEST_CONFIG.TEMPLATES.DEFAULT;
