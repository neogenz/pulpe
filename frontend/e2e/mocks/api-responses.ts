/**
 * Type-safe mock API responses for E2E tests
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

export interface MockBudgetResponse {
  success: boolean;
  data: Array<{
    id: string;
    month: number;
    year: number;
    description: string;
    userId: string;
    templateId: string;
    endingBalance: number;
    rollover: number;
    remaining: number;
    previousBudgetId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface MockTemplateResponse {
  data: Array<{
    id: string;
    name: string;
    is_default: boolean;
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

export interface MockBudgetDetailsResponse {
  success: boolean;
  data: {
    budget: {
      id: string;
      month: number;
      year: number;
      description: string;
      userId: string;
      templateId: string;
      endingBalance: number;
      rollover: number;
      remaining: number;
      previousBudgetId: string | null;
      createdAt: string;
      updatedAt: string;
    };
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
      templateLineId: string | null;
      savingsGoalId: string | null;
      name: string;
      amount: number;
      kind: 'income' | 'expense' | 'saving';
      recurrence: 'fixed' | 'one_off';
      isManuallyAdjusted: boolean;
      checkedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
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

export const createMockBudgetResponse = (): MockBudgetResponse => {
  const now = new Date().toISOString();
  return {
    success: true,
    data: [{
      id: TEST_CONFIG.BUDGETS.CURRENT_MONTH.id,
      month: TEST_CONFIG.BUDGETS.CURRENT_MONTH.month,
      year: TEST_CONFIG.BUDGETS.CURRENT_MONTH.year,
      description: 'E2E Test Budget',
      userId: TEST_CONFIG.USER.ID,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      endingBalance: TEST_CONFIG.BUDGETS.CURRENT_MONTH.available_to_spend,
      rollover: 0,
      remaining: TEST_CONFIG.BUDGETS.CURRENT_MONTH.available_to_spend,
      previousBudgetId: null,
      createdAt: now,
      updatedAt: now,
    }]
  };
};

export const createMockTemplateResponse = (): MockTemplateResponse => ({
  data: [TEST_CONFIG.TEMPLATES.DEFAULT]
});

export const createMockTemplateDetailResponse = (): MockTemplateDetailResponse => ({
  success: true,
  data: {
    id: TEST_CONFIG.TEMPLATES.DEFAULT.id,
    name: TEST_CONFIG.TEMPLATES.DEFAULT.name,
    description: 'Default test template for E2E testing',
    isDefault: TEST_CONFIG.TEMPLATES.DEFAULT.is_default
  }
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

export const createMockBudgetDetailsResponse = (): MockBudgetDetailsResponse => {
  const now = new Date().toISOString();
  const budgetId = TEST_CONFIG.BUDGETS.CURRENT_MONTH.id;

  return {
    success: true,
    data: {
      budget: {
        id: budgetId,
        month: TEST_CONFIG.BUDGETS.CURRENT_MONTH.month,
        year: TEST_CONFIG.BUDGETS.CURRENT_MONTH.year,
        description: 'E2E Test Budget',
        userId: TEST_CONFIG.USER.ID,
        templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
        endingBalance: TEST_CONFIG.BUDGETS.CURRENT_MONTH.available_to_spend,
        rollover: 0,
        remaining: TEST_CONFIG.BUDGETS.CURRENT_MONTH.available_to_spend,
        previousBudgetId: null,
        createdAt: now,
        updatedAt: now,
      },
      transactions: [],
      budgetLines: [
        {
          id: 'e2e-budget-line-1',
          budgetId,
          templateLineId: null,
          savingsGoalId: null,
          name: 'Salaire',
          amount: TEST_CONFIG.BUDGETS.CURRENT_MONTH.total_income,
          kind: 'income',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          checkedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'e2e-budget-line-2',
          budgetId,
          templateLineId: null,
          savingsGoalId: null,
          name: 'Loyer',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          checkedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'e2e-budget-line-3',
          budgetId,
          templateLineId: null,
          savingsGoalId: null,
          name: 'Courses',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          checkedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
};

// Centralized mock responses
export const MOCK_API_RESPONSES = {
  auth: createMockAuthResponse(),
  budgets: createMockBudgetResponse(),
  budgetDetails: createMockBudgetDetailsResponse(),
  templates: createMockTemplateResponse(),
  templateDetail: createMockTemplateDetailResponse(),
  templateLines: createMockTemplateLinesResponse(),
  success: createMockSuccessResponse()
} as const;