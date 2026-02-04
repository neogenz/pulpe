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
  accessToken: 'mock-access-token',
  clientKey: Buffer.from('ab'.repeat(32), 'hex'),
  isDemo: false,
  ...overrides,
});

export const createMockBudgetEntity = (
  overrides: Partial<
    import('@/types/database.types').Tables<'monthly_budget'>
  > = {},
) => ({
  id: MOCK_BUDGET_ID,
  user_id: MOCK_USER_ID,
  template_id: MOCK_TEMPLATE_ID,
  month: 11,
  year: 2024,
  description: 'Test Budget',
  ending_balance: null,
  ending_balance_encrypted: null,
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
  amount_encrypted: null,
  kind: 'expense' as const,
  transaction_date: '2024-01-01T00:00:00.000Z',
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

export const createMockTemplateLineEntity = (
  overrides: Partial<
    import('@/types/database.types').Tables<'template_line'>
  > = {},
) => ({
  id: '550e8400-e29b-41d4-a716-446655440010',
  template_id: MOCK_TEMPLATE_ID,
  name: 'Test Template Line',
  amount: 100,
  amount_encrypted: null,
  kind: 'expense' as const,
  recurrence: 'fixed' as const,
  description: null,
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

    const buildMutationChain = () => {
      const chain: any = {};
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.or = () => chain;
      chain.select = () => {
        const promise = Promise.resolve(result) as any;
        promise.single = () => Promise.resolve(result);
        return promise;
      };
      chain.single = () => Promise.resolve(result);
      chain.then = (resolve: (value: typeof result) => any) =>
        Promise.resolve(result).then(resolve);
      return chain;
    };

    const chainMethods: any = {
      select: () => chainMethods,
      order: () => chainMethods,
      eq: () => chainMethods,
      neq: () => chainMethods,
      gte: () => chainMethods,
      lte: () => chainMethods,
      gt: () => chainMethods,
      lt: () => chainMethods,
      in: () => chainMethods,
      or: () => chainMethods,
      limit: () => chainMethods,
      range: () => chainMethods,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      insert: () => buildMutationChain(),
      update: () => buildMutationChain(),
      delete: () => buildMutationChain(),
      then: (resolve: (value: typeof result) => any) =>
        Promise.resolve(result).then(resolve),
    };
    return chainMethods;
  }

  rpc(_functionName: string, _params: unknown) {
    const result = { data: this.#mockData, error: this.#mockError };

    const chainMethods = {
      single: () => Promise.resolve(result),
      eq: () => chainMethods,
      neq: () => chainMethods,
      gte: () => chainMethods,
      lte: () => chainMethods,
      gt: () => chainMethods,
      lt: () => chainMethods,
      in: () => chainMethods,
      limit: () => chainMethods,
      range: () => chainMethods,
      then: (resolve: (value: typeof result) => any) => {
        return Promise.resolve(result).then(resolve);
      },
    };

    return chainMethods;
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

  update(_data: any) {
    return {
      data: this.#mockData,
      error: this.#mockError,
    };
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
