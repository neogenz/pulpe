import { expect } from 'bun:test';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { ErrorDefinition } from '@common/constants/error-definitions';

// Mock IDs
export const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
export const MOCK_BUDGET_ID = '550e8400-e29b-41d4-a716-446655440002';
export const MOCK_TRANSACTION_ID = '550e8400-e29b-41d4-a716-446655440003';
export const MOCK_TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440004';

// Simple factory functions
export const createMockAuthenticatedUser = (
  overrides?: Partial<AuthenticatedUser>,
): AuthenticatedUser => ({
  id: MOCK_USER_ID,
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

export const createMockBudgetEntity = (
  overrides: Partial<
    import('@/types/database.types').Tables<'monthly_budget'>
  > = {},
) => ({
  id: MOCK_BUDGET_ID,
  user_id: MOCK_USER_ID,
  month: 11,
  year: 2024,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockTransactionEntity = (
  overrides?: Partial<import('@/types/database.types').Tables<'transaction'>>,
) => ({
  id: MOCK_TRANSACTION_ID,
  budget_id: MOCK_BUDGET_ID,
  name: 'Test Transaction',
  amount: 100,
  kind: 'expense' as const,
  transaction_date: '2024-01-01T00:00:00.000Z',
  is_out_of_budget: false,
  category: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockBudgetTemplateDbEntity = (
  overrides?: Partial<import('@/types/database.types').Tables<'template'>>,
) => ({
  id: MOCK_TEMPLATE_ID,
  user_id: MOCK_USER_ID,
  name: 'Test Template',
  description: 'Test Description',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// Simple mock Supabase client
export class MockSupabaseClient {
  #mockData: unknown = null;
  #mockError: unknown = null;

  from(_table: string) {
    const result = { data: this.#mockData, error: this.#mockError };

    const chainMethods = {
      select: () => chainMethods,
      order: () => chainMethods,
      eq: () => chainMethods,
      neq: () => chainMethods,
      gte: () => chainMethods,
      lte: () => chainMethods,
      gt: () => chainMethods,
      lt: () => chainMethods,
      in: () => chainMethods,
      limit: () => chainMethods,
      range: () => chainMethods,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({ data: this.#mockData, error: this.#mockError }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: this.#mockData, error: this.#mockError }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: this.#mockError }),
      }),
      then: (resolve: (value: typeof result) => any) => {
        return Promise.resolve(result).then(resolve);
      },
    };
    return chainMethods;
  }

  rpc(_functionName: string, _params: unknown) {
    return Promise.resolve({
      data: this.#mockData,
      error: this.#mockError,
    });
  }

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: this.#mockData },
        error: this.#mockError,
      }),
  };

  setMockData(data: unknown) {
    this.#mockData = data;
    return this;
  }

  setMockError(error: unknown) {
    this.#mockError = error;
    return this;
  }

  reset() {
    this.#mockData = null;
    this.#mockError = null;
    return this;
  }
}

export const createMockSupabaseClient = () => {
  const mockClient = new MockSupabaseClient();
  return {
    client: mockClient as unknown as AuthenticatedSupabaseClient,
    mockClient,
  };
};

// Simple test helpers
export const expectErrorThrown = async (
  promiseFunction: () => Promise<unknown>,
  expectedErrorType: new (...args: any[]) => any,
  expectedMessage?: string,
): Promise<void> => {
  try {
    await promiseFunction();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    expect(error).toBeInstanceOf(expectedErrorType);
    if (expectedMessage) {
      expect((error as Error).message).toContain(expectedMessage);
    }
  }
};

// Helper for testing BusinessException patterns
export const expectBusinessExceptionThrown = async (
  promiseFunction: () => Promise<unknown>,
  expectedErrorDefinition: ErrorDefinition,
  expectedDetails?: Record<string, unknown>,
): Promise<void> => {
  try {
    await promiseFunction();
    throw new Error('Expected function to throw a BusinessException');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    const businessError = error as BusinessException;
    expect(businessError.code).toBe(expectedErrorDefinition.code);
    expect(businessError.getStatus()).toBe(expectedErrorDefinition.httpStatus);

    if (expectedDetails) {
      expect(businessError.details).toEqual(expectedDetails);
    }
  }
};

// Simple mock logger
export const createMockPinoLogger = () => ({
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  setContext: () => {},
});
