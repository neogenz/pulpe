/**
 * Type-safe mock API responses for E2E tests
 *
 * All response shapes follow Zod schemas from shared/schemas.ts
 * for Zod runtime validation compatibility.
 */

import { TEST_CONFIG } from '../config/test-config';
import { TEST_UUIDS } from '../helpers/api-mocks';

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
  success: true;
  data: Array<{
    id: string;
    name: string;
    description?: string;
    userId?: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface MockTemplateDetailResponse {
  success: true;
  data: {
    id: string;
    name: string;
    description?: string;
    userId?: string;
    isDefault?: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface MockTemplateLinesResponse {
  success: true;
  data: Array<{
    id: string;
    templateId: string;
    name: string;
    amount: number;
    kind: 'income' | 'expense' | 'saving';
    recurrence: 'fixed' | 'one_off';
    description: string;
    createdAt: string;
    updatedAt: string;
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

export const createMockBudgetDetailsResponse = (): MockBudgetDetailsResponse => ({
  success: true,
  data: {
    budget: TEST_CONFIG.BUDGETS.CURRENT_MONTH,
    transactions: [],
    budgetLines: [],
  },
});

export const createMockTemplateResponse = (): MockTemplateResponse => ({
  success: true,
  data: [TEST_CONFIG.TEMPLATES.DEFAULT],
});

export const createMockTemplateDetailResponse = (): MockTemplateDetailResponse => ({
  success: true,
  data: TEST_CONFIG.TEMPLATES.DEFAULT,
});

export const createMockTemplateLinesResponse = (): MockTemplateLinesResponse => ({
  success: true,
  data: [
    {
      id: TEST_UUIDS.LINE_1,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: '',
      createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
      updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
    },
    {
      id: TEST_UUIDS.LINE_2,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      name: 'Loyer',
      amount: 1800,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
      createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
      updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
    },
    {
      id: TEST_UUIDS.LINE_3,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      name: 'Courses',
      amount: 600,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
      createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
      updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
    },
    {
      id: TEST_UUIDS.LINE_4,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      name: 'Transport',
      amount: 200,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
      createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
      updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
    },
    {
      id: TEST_UUIDS.LINE_5,
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      name: 'Épargne',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
      createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
      updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
    },
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
