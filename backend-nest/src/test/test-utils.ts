import { type TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

export const MOCK_USER_ID = 'test-user-id-123';
export const MOCK_BUDGET_ID = 'test-budget-id-456';
export const MOCK_TRANSACTION_ID = 'test-transaction-id-789';
export const MOCK_TEMPLATE_ID = 'test-template-id-101';

export const createMockAuthenticatedUser = (overrides?: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: MOCK_USER_ID,
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

export const createMockBudgetDbEntity = (overrides?: any) => ({
  id: MOCK_BUDGET_ID,
  user_id: MOCK_USER_ID,
  month: 11,
  year: 2024,
  description: 'Test Budget',
  monthly_income: 5000,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockTransactionDbEntity = (overrides?: any) => ({
  id: MOCK_TRANSACTION_ID,
  user_id: MOCK_USER_ID,
  budget_id: MOCK_BUDGET_ID,
  title: 'Test Transaction',
  amount: 100,
  expense_type: 'FIXED',
  transaction_type: 'EXPENSE',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockBudgetTemplateDbEntity = (overrides?: any) => ({
  id: MOCK_TEMPLATE_ID,
  user_id: MOCK_USER_ID,
  name: 'Test Template',
  description: 'Test Description',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// Simplified mock system that works with Bun
export class MockSupabaseClient {
  private mockData: any = null;
  private mockError: any = null;
  private mockRpcData: any = null;
  private mockRpcError: any = null;

  // Mock the chain: from().select().order().eq().single()
  from(table: string) {
    const chainMethods = {
      select: (columns: string) => chainMethods,
      order: (column: string, options?: any) => chainMethods,
      eq: (column: string, value: any) => chainMethods,
      single: () => Promise.resolve({ data: this.mockData, error: this.mockError }),
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: this.mockData, error: this.mockError }),
        }),
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            single: () => Promise.resolve({ data: this.mockData, error: this.mockError }),
          }),
        }),
      }),
      delete: () => ({
        eq: (column: string, value: any) => Promise.resolve({ error: this.mockError }),
      }),
      then: (callback: any) => {
        return Promise.resolve().then(() => callback({ data: this.mockData, error: this.mockError }));
      },
    };

    return chainMethods;
  }

  rpc(functionName: string, params: any) {
    return Promise.resolve({ data: this.mockRpcData, error: this.mockRpcError });
  }

  auth = {
    getUser: () => Promise.resolve({ data: { user: this.mockData }, error: this.mockError }),
  };

  // Helper methods to configure the mock
  setMockData(data: any) {
    this.mockData = data;
    return this;
  }

  setMockError(error: any) {
    this.mockError = error;
    return this;
  }

  setMockRpcData(data: any) {
    this.mockRpcData = data;
    return this;
  }

  setMockRpcError(error: any) {
    this.mockRpcError = error;
    return this;
  }

  reset() {
    this.mockData = null;
    this.mockError = null;
    this.mockRpcData = null;
    this.mockRpcError = null;
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

export const createTestingModuleBuilder = () => {
  const mockConfigService = {
    get: (key: string) => {
      switch (key) {
        case 'SUPABASE_URL':
          return 'https://test-supabase-url.supabase.co';
        case 'SUPABASE_ANON_KEY':
          return 'test-anon-key';
        case 'SUPABASE_SERVICE_ROLE_KEY':
          return 'test-service-role-key';
        default:
          return undefined;
      }
    },
  };

  const mockSupabaseService = {
    createAuthenticatedClient: () => createMockSupabaseClient().client,
    getClient: () => createMockSupabaseClient().client,
    getServiceRoleClient: () => createMockSupabaseClient().client,
  };

  return {
    mockConfigService,
    mockSupabaseService,
  };
};

export const expectSuccessResponse = (response: any, expectedData?: any) => {
  expect(response).toHaveProperty('success', true);
  if (expectedData) {
    expect(response.data).toEqual(expectedData);
  }
};

export const expectErrorThrown = async (
  promiseFunction: () => Promise<any>,
  expectedErrorType: any,
  expectedMessage?: string,
) => {
  try {
    await promiseFunction();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    expect(error).toBeInstanceOf(expectedErrorType);
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    }
  }
};