import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

export const MOCK_USER_ID = 'test-user-id-123';
export const MOCK_BUDGET_ID = 'test-budget-id-456';
export const MOCK_TRANSACTION_ID = 'test-transaction-id-789';
export const MOCK_TEMPLATE_ID = 'test-template-id-101';

export const createMockAuthenticatedUser = (
  overrides?: Partial<AuthenticatedUser>,
): AuthenticatedUser => ({
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

// Enhanced error silencing system
export class TestErrorSilencer {
  #originalConsoleError: typeof console.error;
  #originalConsoleWarn: typeof console.warn;
  #originalConsoleLog: typeof console.log;
  #isActive: boolean = false;

  constructor() {
    this.#originalConsoleError = console.error;
    this.#originalConsoleWarn = console.warn;
    this.#originalConsoleLog = console.log;
  }

  silenceExpectedErrors(): void {
    if (this.#isActive) return;

    this.#isActive = true;
    // Silence all console methods and capture process.stdout/stderr
    console.error = () => {};
    console.warn = () => {};
    console.log = (message: any, ...args: any[]) => {
      // Only allow specific test messages through
      const messageStr = String(message);
      if (
        messageStr.includes('🧪 Test environment') ||
        messageStr.includes('🚀 Starting load test')
      ) {
        this.#originalConsoleLog(message, ...args);
      }
      // Silence NestJS logs and other noise
    };
  }

  restoreErrorLogging(): void {
    if (!this.#isActive) return;

    console.error = this.#originalConsoleError;
    console.warn = this.#originalConsoleWarn;
    console.log = this.#originalConsoleLog;
    this.#isActive = false;
  }

  async withSilencedErrors<T>(testFunction: () => Promise<T>): Promise<T> {
    this.silenceExpectedErrors();
    try {
      return await testFunction();
    } finally {
      this.restoreErrorLogging();
    }
  }
}

export const testErrorSilencer = new TestErrorSilencer();

// Enhanced MockSupabaseClient with private fields
export class MockSupabaseClient {
  #mockData: any = null;
  #mockError: any = null;
  #mockRpcData: any = null;
  #mockRpcError: any = null;

  // Mock the chain: from().select().order().eq().single()
  from(_table: string) {
    const chainMethods = {
      select: (_columns: string) => chainMethods,
      order: (_column: string, _options?: any) => chainMethods,
      eq: (_column: string, _value: any) => chainMethods,
      single: () =>
        Promise.resolve({ data: this.#mockData, error: this.#mockError }),
      insert: (_data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({ data: this.#mockData, error: this.#mockError }),
        }),
      }),
      update: (_data: any) => ({
        eq: (_column: string, _value: any) => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: this.#mockData, error: this.#mockError }),
          }),
        }),
      }),
      delete: () => ({
        eq: (_column: string, _value: any) =>
          Promise.resolve({ error: this.#mockError }),
      }),
      then: (_callback: any) => {
        return Promise.resolve().then(() =>
          _callback({ data: this.#mockData, error: this.#mockError }),
        );
      },
    };

    return chainMethods;
  }

  rpc(_functionName: string, _params: any) {
    return Promise.resolve({
      data: this.#mockRpcData,
      error: this.#mockRpcError,
    });
  }

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: this.#mockData },
        error: this.#mockError,
      }),
  };

  // Helper methods to configure the mock
  setMockData(data: any): this {
    this.#mockData = data;
    return this;
  }

  setMockError(error: any): this {
    this.#mockError = error;
    return this;
  }

  setMockRpcData(data: any): this {
    this.#mockRpcData = data;
    return this;
  }

  setMockRpcError(error: any): this {
    this.#mockRpcError = error;
    return this;
  }

  reset(): this {
    this.#mockData = null;
    this.#mockError = null;
    this.#mockRpcData = null;
    this.#mockRpcError = null;
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

export const expectSuccessResponse = (
  response: any,
  expectedData?: any,
): void => {
  expect(response).toHaveProperty('success', true);
  if (expectedData) {
    expect(response.data).toEqual(expectedData);
  }
};

export const expectBudgetStructure = (budget: any): void => {
  expect(budget).toMatchObject({
    id: expect.any(String),
    month: expect.any(Number),
    year: expect.any(Number),
    description: expect.any(String),
    monthlyIncome: expect.any(Number),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });

  // Validate business rules
  expect(budget.month).toBeGreaterThanOrEqual(1);
  expect(budget.month).toBeLessThanOrEqual(12);
  expect(budget.year).toBeGreaterThan(2000);
  expect(budget.monthlyIncome).toBeGreaterThanOrEqual(0);
  expect(budget.description).toBeTruthy();
};

export const expectBudgetDbEntityStructure = (budget: any): void => {
  expect(budget).toMatchObject({
    id: expect.any(String),
    month: expect.any(Number),
    year: expect.any(Number),
    description: expect.any(String),
    monthly_income: expect.any(Number),
    created_at: expect.any(String),
    updated_at: expect.any(String),
    user_id: expect.any(String),
  });

  // Validate business rules
  expect(budget.month).toBeGreaterThanOrEqual(1);
  expect(budget.month).toBeLessThanOrEqual(12);
  expect(budget.year).toBeGreaterThan(2000);
  expect(budget.monthly_income).toBeGreaterThanOrEqual(0);
  expect(budget.description).toBeTruthy();
};

export const expectTransactionStructure = (transaction: any): void => {
  expect(transaction).toMatchObject({
    id: expect.any(String),
    budgetId: expect.any(String),
    title: expect.any(String),
    amount: expect.any(Number),
    expenseType: expect.stringMatching(/^(FIXED|VARIABLE)$/),
    transactionType: expect.stringMatching(/^(INCOME|EXPENSE)$/),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });

  // Validate business rules
  expect(transaction.amount).toBeGreaterThan(0);
  expect(transaction.title).toBeTruthy();
  expect(transaction.budgetId).toBeTruthy();
};

export const expectListResponse = <T>(
  response: any,
  validator: (item: T) => void,
  expectedMinLength: number = 0,
): void => {
  expectSuccessResponse(response);
  expect(Array.isArray(response.data)).toBe(true);
  expect(response.data.length).toBeGreaterThanOrEqual(expectedMinLength);
  response.data.forEach(validator);
};

export const expectPerformance = async (
  operation: () => Promise<any>,
  maxExecutionTimeMs: number = 100,
  operationName: string = 'operation',
): Promise<void> => {
  const startTime = Date.now();
  await operation();
  const executionTime = Date.now() - startTime;

  expect(executionTime).toBeLessThan(maxExecutionTimeMs);

  if (process.env.DEBUG_PERFORMANCE === 'true') {
    console.log(
      `⚡ ${operationName} executed in ${executionTime}ms (limit: ${maxExecutionTimeMs}ms)`,
    );
  }
};

export const expectApiResponseStructure = (response: any): void => {
  expect(response).toMatchObject({
    success: expect.any(Boolean),
    data: expect.anything(),
  });

  if (response.success === false) {
    expect(response).toHaveProperty('error');
    expect(response.error).toBeTruthy();
  }
};

export const expectDatabaseError = (error: any): void => {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBeTruthy();
  expect(typeof error.message).toBe('string');
};

export const expectValidTimestamp = (timestamp: string): void => {
  expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const date = new Date(timestamp);
  expect(date.getTime()).not.toBeNaN();
};

export const expectValidUuid = (id: string): void => {
  expect(id).toMatch(
    /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,
  );
};

export const expectErrorThrown = async (
  promiseFunction: () => Promise<any>,
  expectedErrorType: any,
  expectedMessage?: string,
): Promise<void> => {
  await testErrorSilencer.withSilencedErrors(async () => {
    try {
      await promiseFunction();
      throw new Error('Expected function to throw an error');
    } catch (error) {
      expect(error).toBeInstanceOf(expectedErrorType);
      if (expectedMessage) {
        expect((error as Error).message).toContain(expectedMessage);
      }
      expectDatabaseError(error as Error);
    }
  });
};

// Load testing utilities
export class LoadTestRunner {
  #concurrentRequests: number;
  #_testDuration: number;

  constructor(concurrentRequests: number = 10, testDurationMs: number = 5000) {
    this.#concurrentRequests = concurrentRequests;
    this.#_testDuration = testDurationMs;
  }

  async runConcurrentTest<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation',
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const results: Array<{
      success: boolean;
      duration: number;
      error?: Error;
    }> = [];

    console.log(
      `🚀 Starting load test: ${
        this.#concurrentRequests
      } concurrent ${operationName}`,
    );

    const promises = Array.from(
      { length: this.#concurrentRequests },
      async (_, _index) => {
        const operationStart = Date.now();
        try {
          await operation();
          const duration = Date.now() - operationStart;
          results.push({ success: true, duration });
        } catch (error) {
          const duration = Date.now() - operationStart;
          results.push({ success: false, duration, error: error as Error });
        }
      },
    );

    await Promise.allSettled(promises);
    const totalDuration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    const averageDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    const loadTestResult: LoadTestResult = {
      totalRequests: this.#concurrentRequests,
      successfulRequests: successCount,
      failedRequests: results.length - successCount,
      averageResponseTime: averageDuration,
      totalDuration,
      requestsPerSecond: (this.#concurrentRequests / totalDuration) * 1000,
    };

    if (process.env.DEBUG_PERFORMANCE === 'true') {
      console.log(`📊 Load test results for ${operationName}:`, loadTestResult);
    }

    return loadTestResult;
  }
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalDuration: number;
  requestsPerSecond: number;
}

export const expectLoadTestPerformance = (
  result: LoadTestResult,
  expectations: {
    minSuccessRate?: number;
    maxAverageResponseTime?: number;
    minRequestsPerSecond?: number;
  },
): void => {
  const successRate = (result.successfulRequests / result.totalRequests) * 100;

  if (expectations.minSuccessRate !== undefined) {
    expect(successRate).toBeGreaterThanOrEqual(expectations.minSuccessRate);
  }

  if (expectations.maxAverageResponseTime !== undefined) {
    expect(result.averageResponseTime).toBeLessThanOrEqual(
      expectations.maxAverageResponseTime,
    );
  }

  if (expectations.minRequestsPerSecond !== undefined) {
    expect(result.requestsPerSecond).toBeGreaterThanOrEqual(
      expectations.minRequestsPerSecond,
    );
  }
};
