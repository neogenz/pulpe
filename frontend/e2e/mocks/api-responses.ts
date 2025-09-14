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
  data: Array<{
    id: string;
    month: number;
    year: number;
    total_income: number;
    total_expenses: number;
    available_to_spend: number;
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
  data: [TEST_CONFIG.BUDGETS.CURRENT_MONTH]
});

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

// Centralized mock responses
export const MOCK_API_RESPONSES = {
  auth: createMockAuthResponse(),
  budgets: createMockBudgetResponse(),
  templates: createMockTemplateResponse(),
  templateDetail: createMockTemplateDetailResponse(),
  templateLines: createMockTemplateLinesResponse(),
  success: createMockSuccessResponse()
} as const;