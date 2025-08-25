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

export const createMockSuccessResponse = (): MockGenericResponse => ({
  success: true,
  data: {}
});

// Centralized mock responses
export const MOCK_API_RESPONSES = {
  auth: createMockAuthResponse(),
  budgets: createMockBudgetResponse(),
  templates: createMockTemplateResponse(),
  success: createMockSuccessResponse()
} as const;