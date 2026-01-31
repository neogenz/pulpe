/**
 * Type-safe mock API responses for E2E tests
 *
 * All response shapes follow Zod schemas from shared/schemas.ts
 * for Zod runtime validation compatibility.
 */

import { TEST_CONFIG } from '../config/test-config';

// Define typed interfaces for API responses
export interface MockAuthResponse {
  user: {
    id: string;
    email: string;
  };
  session?: {
    access_token: string;
    user: {
      id: string;
      email: string;
    };
  };
}

// Follows budgetListResponseSchema from shared/schemas.ts:510-514
export interface MockBudgetResponse {
  success: true;
  data: Array<{
    id: string;
    userId: string;
    templateId: string;
    month: number;
    year: number;
    description: string;
    endingBalance: number | null;
    rollover?: number;
    remaining?: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Follows budgetDetailsResponseSchema from shared/schemas.ts:527-535
export interface MockBudgetDetailsResponse {
  success: true;
  data: {
    budget: MockBudgetResponse['data'][0];
    transactions: Array<{
      id: string;
      budgetId: string;
      budgetLineId: string | null;
      name: string;
      amount: number;
      kind: 'income' | 'expense' | 'saving';
      transactionDate: string;
      category: string | null;
      createdAt: string;
      updatedAt: string;
      checkedAt: string | null;
    }>;
    budgetLines: Array<{
      id: string;
      budgetId: string;
      name: string;
      amount: number;
      kind: 'income' | 'expense' | 'saving';
      recurrence: 'fixed' | 'one_off';
      isManuallyAdjusted: boolean;
      templateLineId: string | null;
      savingsGoalId: string | null;
      checkedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

export interface MockTemplateResponse {
  data: Array<{
    id: string;
    name: string;
    isDefault: boolean;
  }>;
}

export interface MockTemplateDetailResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
  };
}

export interface MockTemplateLinesResponse {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    amount: number;
    kind: 'income' | 'expense' | 'saving';
  }>;
}

export interface MockGenericResponse {
  success: boolean;
  data: Record<string, unknown>;
}

// Factory functions for creating mock responses
export const createMockAuthResponse = (): MockAuthResponse => ({
  user: {
    id: TEST_CONFIG.USER.ID,
    email: TEST_CONFIG.USER.EMAIL
  },
  session: {
    access_token: TEST_CONFIG.TOKENS.ACCESS,
    user: {
      id: TEST_CONFIG.USER.ID,
      email: TEST_CONFIG.USER.EMAIL
    }
  }
});

export const createMockBudgetResponse = (): MockBudgetResponse => ({
  success: true,
  data: [TEST_CONFIG.BUDGETS.CURRENT_MONTH],
});

export const createMockBudgetDetailsResponse = (): MockBudgetDetailsResponse => {
  const now = new Date().toISOString();
  const budgetId = TEST_CONFIG.BUDGETS.CURRENT_MONTH.id;

  return {
    success: true,
    data: {
      budget: TEST_CONFIG.BUDGETS.CURRENT_MONTH,
      transactions: [
        {
          id: '00000000-0000-4000-a000-000000000301',
          budgetId,
          budgetLineId: null,
          name: 'Test Transaction 1',
          amount: 50,
          kind: 'expense' as const,
          transactionDate: now,
          category: 'Test',
          createdAt: now,
          updatedAt: now,
          checkedAt: null,
        },
        {
          id: '00000000-0000-4000-a000-000000000302',
          budgetId,
          budgetLineId: null,
          name: 'Test Transaction 2',
          amount: 100,
          kind: 'expense' as const,
          transactionDate: now,
          category: 'Test',
          createdAt: now,
          updatedAt: now,
          checkedAt: null,
        },
      ],
      budgetLines: [
        {
          id: '00000000-0000-4000-a000-000000000401',
          budgetId,
          name: 'Test Budget Line 1',
          amount: 200,
          kind: 'expense' as const,
          recurrence: 'fixed' as const,
          isManuallyAdjusted: false,
          templateLineId: null,
          savingsGoalId: null,
          checkedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '00000000-0000-4000-a000-000000000402',
          budgetId,
          name: 'Test Budget Line 2',
          amount: 300,
          kind: 'expense' as const,
          recurrence: 'fixed' as const,
          isManuallyAdjusted: false,
          templateLineId: null,
          savingsGoalId: null,
          checkedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
};

export const createMockTemplateResponse = (): MockTemplateResponse => ({
  data: [TEST_CONFIG.TEMPLATES.DEFAULT],
});

export const createMockTemplateDetailResponse = (): MockTemplateDetailResponse => ({
  success: true,
  data: {
    id: TEST_CONFIG.TEMPLATES.DEFAULT.id,
    name: TEST_CONFIG.TEMPLATES.DEFAULT.name,
    description: 'Default test template for E2E testing',
    isDefault: TEST_CONFIG.TEMPLATES.DEFAULT.isDefault,
  },
});

export const createMockTemplateLinesResponse = (): MockTemplateLinesResponse => ({
  success: true,
  data: [
    { id: '1', name: 'Salaire', amount: 5000, kind: 'income' },
    { id: '2', name: 'Loyer', amount: 1800, kind: 'expense' },
    { id: '3', name: 'Courses', amount: 600, kind: 'expense' },
    { id: '4', name: 'Transport', amount: 200, kind: 'expense' },
    { id: '5', name: 'Épargne', amount: 500, kind: 'saving' }
  ]
});

export const createMockSuccessResponse = (): MockGenericResponse => ({
  success: true,
  data: {}
});

// Centralized mock responses
export const MOCK_API_RESPONSES = {
  auth: createMockAuthResponse(),
  budgets: createMockBudgetResponse(),
  budgetDetails: createMockBudgetDetailsResponse(),
  templates: createMockTemplateResponse(),
  templateDetail: createMockTemplateDetailResponse(),
  templateLines: createMockTemplateLinesResponse(),
  success: createMockSuccessResponse(),
} as const;