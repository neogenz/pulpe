import type { TestingModule } from '@nestjs/testing';
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

export const createMockSupabaseClient = () => {
  const mockFrom = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();
  const mockInsert = jest.fn().mockReturnThis();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockDelete = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockOrder = jest.fn().mockReturnThis();
  const mockSingle = jest.fn();
  const mockRpc = jest.fn();

  const mockQuery = {
    from: mockFrom,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    rpc: mockRpc,
  };

  const mockSupabaseClient = {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: jest.fn(),
    },
  };

  // Chain methods
  mockFrom.mockReturnValue(mockQuery);
  mockSelect.mockReturnValue(mockQuery);
  mockInsert.mockReturnValue(mockQuery);
  mockUpdate.mockReturnValue(mockQuery);
  mockDelete.mockReturnValue(mockQuery);
  mockEq.mockReturnValue(mockQuery);
  mockOrder.mockReturnValue(mockQuery);

  return {
    client: mockSupabaseClient as unknown as AuthenticatedSupabaseClient,
    mocks: {
      from: mockFrom,
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      rpc: mockRpc,
    },
  };
};

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

export const createTestingModuleBuilder = () => {
  const mockConfigService = {
    get: jest.fn((key: string) => {
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
    }),
  };

  const mockSupabaseService = {
    createAuthenticatedClient: jest.fn().mockReturnValue(createMockSupabaseClient().client),
    getClient: jest.fn().mockReturnValue(createMockSupabaseClient().client),
    getServiceRoleClient: jest.fn().mockReturnValue(createMockSupabaseClient().client),
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
  await expect(promiseFunction()).rejects.toThrow(expectedErrorType);
  if (expectedMessage) {
    await expect(promiseFunction()).rejects.toThrow(expectedMessage);
  }
};