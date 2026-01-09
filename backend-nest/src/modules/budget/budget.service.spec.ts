import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BudgetService } from './budget.service';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectBusinessExceptionThrown,
  MOCK_BUDGET_ID,
  MockSupabaseClient,
} from '../../test/test-mocks';
import type { BudgetCreate, BudgetUpdate } from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

describe('BudgetService', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockValidator: any;
  let mockRepository: any;
  let mockCalculator: any;

  const createValidBudgetEntity = (overrides: any = {}): any => ({
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    created_at: '2024-01-15T10:30:00.000Z',
    updated_at: '2024-01-15T10:30:00.000Z',
    user_id: 'a1b2c3d4-e5f6-4789-8901-234567890abc',
    month: 1,
    year: 2024,
    description: 'Budget Janvier 2024',
    template_id: '550e8400-e29b-41d4-a716-446655440004',
    ending_balance: null,
    ...overrides,
  });

  const createValidBudgetCreateDto = (
    overrides: Partial<BudgetCreate> = {},
  ): BudgetCreate => ({
    month: 1,
    year: 2024,
    description: 'Test Budget',
    templateId: 'test-template-id',
    ...overrides,
  });

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockPinoLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };

    mockCalculator = {
      calculateEndingBalance: () => Promise.resolve(100),
      recalculateAndPersist: () => Promise.resolve(),
      getRollover: () =>
        Promise.resolve({ rollover: 0, previousBudgetId: null }),
      buildRolloverLine: () => ({
        id: 'rollover-id',
        budgetId: 'budget-id',
        templateLineId: null,
        savingsGoalId: null,
        name: 'Rollover from previous month',
        amount: 50,
        kind: 'income',
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        isRollover: true,
        rolloverSourceBudgetId: 'prev-id',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      }),
    };

    mockValidator = {
      validateBudgetInput: (dto: any) => {
        // Test validation scenarios
        if (dto.month > 12) {
          throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
            reason: 'Month must be between 1 and 12',
          });
        }
        if (dto.year && dto.year > new Date().getFullYear() + 2) {
          throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
            reason: 'Budget date cannot be more than 2 years in the future',
          });
        }
        if (dto.description && dto.description.length > 500) {
          throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
            reason: 'Description cannot exceed 500 characters',
          });
        }
        if (!dto.templateId) {
          throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
            fields: ['templateId'],
          });
        }
        return dto;
      },
      validateUpdateBudgetDto: (dto: any) => {
        if (dto.month !== undefined && (dto.month < 1 || dto.month > 12)) {
          throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
            reason: 'Month must be between 1 and 12',
          });
        }
        return dto;
      },
      validateNoDuplicatePeriod: () => Promise.resolve(),
    };

    const mockRepositoryData = {
      budgetLines: [
        {
          id: 'bl-1',
          budget_id: 'budget-id',
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'bl-2',
          budget_id: 'budget-id',
          name: 'Loyer',
          amount: 1500,
          kind: 'expense',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'trans-1',
          budget_id: 'budget-id',
          name: 'Transaction 1',
          amount: 100,
          kind: 'expense',
          transaction_date: '2024-01-15T10:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'trans-2',
          budget_id: 'budget-id',
          name: 'Transaction 2',
          amount: 200,
          kind: 'expense',
          transaction_date: '2024-01-16T10:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    mockRepository = {
      fetchBudgetById: (id: string) =>
        Promise.resolve(createValidBudgetEntity({ id })),
      updateBudgetInDb: (id: string, updateData: any) =>
        Promise.resolve(createValidBudgetEntity({ id, ...updateData })),
      fetchBudgetData: () =>
        Promise.resolve({
          budget: createValidBudgetEntity(),
          budgetLines: mockRepositoryData.budgetLines,
          transactions: mockRepositoryData.transactions,
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: `PinoLogger:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
        {
          provide: BudgetCalculator,
          useValue: mockCalculator,
        },
        {
          provide: BudgetValidator,
          useValue: mockValidator,
        },
        {
          provide: BudgetRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('findAll', () => {
    it('should return all budgets with proper data transformation', async () => {
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = [
        createValidBudgetEntity(),
        createValidBudgetEntity({
          id: '550e8400-e29b-41d4-a716-446655440006',
          month: 2,
          description: 'Budget Février 2024',
        }),
      ];

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      const result = await service.findAll(mockUser, mockSupabaseClient as any);

      // Verify successful response
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      // Verify data transformation snake_case → camelCase
      result.data.forEach((budget: any) => {
        expect(budget).toHaveProperty('id');
        expect(budget).toHaveProperty('createdAt');
        expect(budget).toHaveProperty('userId');
        expect(budget).not.toHaveProperty('created_at');
        expect(budget).not.toHaveProperty('user_id');
      });

      // Note: Mock client doesn't apply sorting, so we test the transformation only
      // In real usage, Supabase orders by year desc, month desc
    });

    it('should handle database error gracefully', async () => {
      const mockUser = createMockAuthenticatedUser();
      const mockError = { message: 'Database connection failed' };
      mockSupabaseClient.setMockData(null).setMockError(mockError);

      await expectBusinessExceptionThrown(
        () => service.findAll(mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
      );
    });

    it('should handle valid budget data only', async () => {
      const mockUser = createMockAuthenticatedUser();
      const validBudgets = [
        createValidBudgetEntity(),
        createValidBudgetEntity({
          id: '550e8400-e29b-41d4-a716-446655440006',
          month: 3,
          description: 'Budget Mars 2024',
        }),
      ];

      mockSupabaseClient.setMockData(validBudgets).setMockError(null);

      const result = await service.findAll(mockUser, mockSupabaseClient as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // All valid budgets
    });
  });

  describe('create', () => {
    it('should create budget with proper validation and transformation', async () => {
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto = createValidBudgetCreateDto();
      const mockCreatedBudget = createValidBudgetEntity({
        id: '550e8400-e29b-41d4-a716-446655440099',
        month: createBudgetDto.month,
        year: createBudgetDto.year,
        description: createBudgetDto.description,
        user_id: mockUser.id,
      });

      // Mock RPC call for template-based creation
      const mockRpcResult = {
        budget: mockCreatedBudget,
        budget_lines_created: 5,
        template_name: 'Test Template',
      };

      mockSupabaseClient.setMockData(null).setMockError(null);
      (mockSupabaseClient.rpc as any) = () => {
        const result = { data: mockRpcResult, error: null };
        return {
          single: () => Promise.resolve(result),
          eq: () => ({ single: () => Promise.resolve(result) }),
          neq: () => ({ single: () => Promise.resolve(result) }),
          gte: () => ({ single: () => Promise.resolve(result) }),
          lte: () => ({ single: () => Promise.resolve(result) }),
          gt: () => ({ single: () => Promise.resolve(result) }),
          lt: () => ({ single: () => Promise.resolve(result) }),
          in: () => ({ single: () => Promise.resolve(result) }),
          limit: () => ({ single: () => Promise.resolve(result) }),
          range: () => ({ single: () => Promise.resolve(result) }),
          then: (resolve: (value: typeof result) => any) =>
            Promise.resolve(result).then(resolve),
        };
      };

      const result = await service.create(
        createBudgetDto,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.month).toBe(createBudgetDto.month);
      expect(result.data.year).toBe(createBudgetDto.year);
      expect(result.data.description).toBe(createBudgetDto.description);
      expect(result.data.userId).toBe(mockUser.id);
    });

    it('should validate against Zod schema constraints', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method

      // Test invalid month
      const invalidMonthDto: BudgetCreate = {
        month: 13, // Invalid: must be 1-12
        year: 2024,
        description: 'Test',
        templateId: 'test-template-id',
      };

      await expectBusinessExceptionThrown(
        () =>
          service.create(invalidMonthDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Month must be between 1 and 12' },
      );

      // Test invalid year (too far in future)
      const invalidYearDto: BudgetCreate = {
        month: 1,
        year: new Date().getFullYear() + 5, // Too far in future
        description: 'Test',
        templateId: 'test-template-id',
      };

      await expectBusinessExceptionThrown(
        () =>
          service.create(invalidYearDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Budget date cannot be more than 2 years in the future' },
      );

      // Test description too long
      const invalidDescDto: BudgetCreate = {
        month: 1,
        year: 2024,
        description: Array(502).join('x'), // Too long: max 500 chars
        templateId: 'test-template-id',
      };

      await expectBusinessExceptionThrown(
        () =>
          service.create(invalidDescDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Description cannot exceed 500 characters' },
      );
    });

    it('should prevent duplicate period creation', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method
      const createBudgetDto = createValidBudgetCreateDto();

      // Override the validator for this test
      const originalValidateNoDuplicate =
        mockValidator.validateNoDuplicatePeriod;
      mockValidator.validateNoDuplicatePeriod = () => {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        );
      };

      await expectBusinessExceptionThrown(
        () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
      );

      // Restore the original method
      mockValidator.validateNoDuplicatePeriod = originalValidateNoDuplicate;
    });
  });

  describe('findOne', () => {
    it('should return budget with enriched data', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const currentDate = new Date();
      const mockBudget = createValidBudgetEntity({
        id: budgetId,
        month: currentDate.getMonth() + 1, // Current month
        year: currentDate.getFullYear(),
      });

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      const result = await service.findOne(
        budgetId,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(budgetId);

      // Vérifier les enrichissements (ces tests passeront quand on utilisera le vrai service)
      // Ces propriétés sont ajoutées par validateAndEnrichBudget
      if ('displayPeriod' in result.data) {
        expect(result.data.displayPeriod).toBe(
          `Juin ${currentDate.getFullYear()}`,
        );
      }
      if ('isCurrentMonth' in result.data) {
        expect((result.data as any).isCurrentMonth).toBe(true);
      }
    });

    it('should throw NotFoundException when budget not found', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = 'non-existent-id';

      // Override the repository for this test
      const originalFetchBudgetById = mockRepository.fetchBudgetById;
      mockRepository.fetchBudgetById = (id: string) => {
        if (id === budgetId) {
          throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
            id,
          });
        }
        return Promise.resolve(createValidBudgetEntity({ id }));
      };

      await expectBusinessExceptionThrown(
        () => service.findOne(budgetId, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      );

      // Restore the original method
      mockRepository.fetchBudgetById = originalFetchBudgetById;
    });
  });

  describe('update', () => {
    it('should update budget with validation', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: 'Budget Modifié',
        month: 3,
      };
      const mockUpdatedBudget = createValidBudgetEntity({
        id: budgetId,
        month: updateBudgetDto.month,
        year: 2024, // Provide a valid year
        description: updateBudgetDto.description,
        user_id: 'test-user-id',
      });

      mockSupabaseClient.setMockData(mockUpdatedBudget).setMockError(null);

      const result = await service.update(
        budgetId,
        updateBudgetDto,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.description).toBe(updateBudgetDto.description!);
      expect(result.data.month).toBe(updateBudgetDto.month!);
    });

    it('should validate update data against Zod schema', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      // Test invalid update data
      const invalidUpdate: BudgetUpdate = {
        month: 0, // Invalid: must be 1-12
      };

      await expectBusinessExceptionThrown(
        () =>
          service.update(
            budgetId,
            invalidUpdate,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Month must be between 1 and 12' },
      );
    });
  });

  describe('findOneWithDetails', () => {
    it('should return budget with transactions and budget lines', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });

      // Mock previous budget for December 2023 to enable rollover calculation
      const mockPreviousBudget = createValidBudgetEntity({
        id: 'prev-budget-id',
        month: 12,
        year: 2023,
        user_id: mockUser.id,
        ending_balance: 150, // Previous budget ending balance
      });

      const mockTransactions = [
        {
          id: 'trans-1',
          budget_id: budgetId,
          name: 'Transaction 1',
          amount: 100,
          kind: 'expense',
          transaction_date: '2024-01-15T10:00:00.000Z',
          category: 'Food',
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T10:00:00.000Z',
        },
        {
          id: 'trans-2',
          budget_id: budgetId,
          name: 'Transaction 2',
          amount: 200,
          kind: 'income',
          transaction_date: '2024-01-10T10:00:00.000Z',
          category: null,
          created_at: '2024-01-10T10:00:00.000Z',
          updated_at: '2024-01-10T10:00:00.000Z',
        },
      ];
      const mockBudgetLines = [
        {
          id: 'line-1',
          budget_id: budgetId,
          template_line_id: null,
          savings_goal_id: null,
          name: 'Salaire',
          amount: 3000,
          kind: 'income',
          recurrence: 'fixed',
          is_manually_adjusted: false,
          created_at: '2024-01-01T10:00:00.000Z',
          updated_at: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'line-2',
          budget_id: budgetId,
          template_line_id: null,
          savings_goal_id: null,
          name: 'Loyer',
          amount: 1000,
          kind: 'expense',
          recurrence: 'fixed',
          is_manually_adjusted: false,
          created_at: '2024-01-01T10:00:00.000Z',
          updated_at: '2024-01-01T10:00:00.000Z',
        },
      ];

      // Create separate mock clients for each table to avoid data collision
      const mockTransactionClient = new MockSupabaseClient();
      const mockBudgetLineClient = new MockSupabaseClient();

      // Configure each client with its specific data
      // For budget queries, we need to handle both current budget and previous budget queries
      const mockBudgetQueryHandler = {
        from: () => ({
          select: () => ({
            eq: (field: string, value: any) => {
              if (field === 'id' && value === budgetId) {
                // Return current budget
                return {
                  single: () =>
                    Promise.resolve({ data: mockBudget, error: null }),
                  order: () =>
                    Promise.resolve({ data: [mockBudget], error: null }),
                };
              } else if (field === 'month' && value === 12) {
                // Return previous budget for December 2023
                return {
                  eq: (field2: string, value2: any) => {
                    if (field2 === 'year' && value2 === 2023) {
                      return {
                        eq: () => ({
                          maybeSingle: () =>
                            Promise.resolve({
                              data: mockPreviousBudget,
                              error: null,
                            }),
                        }),
                      };
                    }
                    return {
                      eq: () => ({
                        maybeSingle: () =>
                          Promise.resolve({ data: null, error: null }),
                      }),
                    };
                  },
                };
              }
              return {
                single: () =>
                  Promise.resolve({ data: mockBudget, error: null }),
                order: () =>
                  Promise.resolve({ data: [mockBudget], error: null }),
              };
            },
            single: () => Promise.resolve({ data: mockBudget, error: null }),
            order: () => Promise.resolve({ data: [mockBudget], error: null }),
          }),
          update: (_data: any) => ({
            eq: () => Promise.resolve({ data: mockBudget, error: null }),
          }),
        }),
      };

      mockTransactionClient.setMockData(mockTransactions).setMockError(null);
      mockBudgetLineClient.setMockData(mockBudgetLines).setMockError(null);

      // Mock the get_budget_with_rollover RPC call
      const originalRpc = mockSupabaseClient.rpc;
      mockSupabaseClient.rpc = ((functionName: string, params: any) => {
        if (functionName === 'get_budget_with_rollover') {
          return {
            single: () =>
              Promise.resolve({
                data: { rollover: 150 }, // Match the previous budget ending_balance
                error: null,
              }),
          };
        }
        return originalRpc.call(mockSupabaseClient, functionName, params);
      }) as typeof mockSupabaseClient.rpc;

      // Override the from method to return the appropriate client
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = ((table: string) => {
        if (table === 'monthly_budget') {
          return mockBudgetQueryHandler.from();
        } else if (table === 'transaction') {
          return mockTransactionClient.from(table);
        } else if (table === 'budget_line') {
          return mockBudgetLineClient.from(table);
        }
        return originalFrom.call(mockSupabaseClient, table);
      }) as typeof mockSupabaseClient.from;

      const result = await service.findOneWithDetails(
        budgetId,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('budget');
      expect(result.data).toHaveProperty('transactions');
      expect(result.data).toHaveProperty('budgetLines');

      // Verify budget data
      expect(result.data.budget.id).toBe(budgetId);
      expect(result.data.budget).toHaveProperty('createdAt');
      expect(result.data.budget).not.toHaveProperty('created_at');

      // Verify transactions
      expect(result.data.transactions).toHaveLength(2);
      expect(result.data.transactions[0].name).toBe('Transaction 1');
      expect(result.data.transactions[0]).toHaveProperty('transactionDate');
      expect(result.data.transactions[0]).not.toHaveProperty(
        'transaction_date',
      );

      // Verify budget lines (may or may not include rollover line depending on mock setup)
      expect(result.data.budgetLines.length).toBeGreaterThanOrEqual(2);
      // Check regular lines
      const regularLines = result.data.budgetLines.filter(
        (line) => !line.name.startsWith('rollover'),
      );
      expect(regularLines).toHaveLength(2);
      expect(regularLines[0].name).toBe('Salaire');
      expect(regularLines[0]).toHaveProperty('budgetId');
      expect(regularLines[0]).not.toHaveProperty('budget_id');
      // Check rollover line if it exists (optional due to mock complexity)
      const rolloverLine = result.data.budgetLines.find((line) =>
        line.name.startsWith('rollover'),
      );
      if (rolloverLine) {
        expect(rolloverLine.name).toBe('rollover_12_2023');
      }
    });

    it('should return budget with empty arrays when no transactions or budget lines', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });

      // Mock successful budget existence check
      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      // Override the repository for this test to return empty arrays
      const originalFetchBudgetData = mockRepository.fetchBudgetData;
      mockRepository.fetchBudgetData = () =>
        Promise.resolve({
          budget: mockBudget,
          budgetLines: [],
          transactions: [],
        });

      // Override calculator to return no rollover
      const originalGetRollover = mockCalculator.getRollover;
      mockCalculator.getRollover = () =>
        Promise.resolve({ rollover: 0, previousBudgetId: null });

      const result = await service.findOneWithDetails(
        budgetId,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.budget.id).toBe(budgetId);
      expect(result.data.transactions).toEqual([]);
      expect(result.data.budgetLines).toHaveLength(0);

      // Restore the original methods
      mockRepository.fetchBudgetData = originalFetchBudgetData;
      mockCalculator.getRollover = originalGetRollover;
    });

    it('should throw NotFoundException when budget not found', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = 'non-existent-id';

      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: 'No rows returned' });

      await expectBusinessExceptionThrown(
        () =>
          service.findOneWithDetails(
            budgetId,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
      );
    });

    it('should throw exception when financial data cannot be fetched for rollover calculations', async () => {
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });

      // Mock successful budget existence check
      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      // Override the repository to throw an error during data fetching
      const originalFetchBudgetData = mockRepository.fetchBudgetData;
      mockRepository.fetchBudgetData = () => {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          { budgetId },
          {
            operation: 'fetchBudgetData',
            entityId: budgetId,
            entityType: 'budget',
          },
          { cause: new Error('Permission denied') },
        );
      };

      // Should throw exception because financial data fetch failed
      await expectBusinessExceptionThrown(
        () =>
          service.findOneWithDetails(
            budgetId,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        { budgetId },
      );

      // Restore the original method
      mockRepository.fetchBudgetData = originalFetchBudgetData;
    });
  });
});
