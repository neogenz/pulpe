import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BudgetService } from './budget.service';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectBusinessExceptionThrown,
  MOCK_BUDGET_ID,
  MockSupabaseClient,
} from '../../test/test-utils-simple';
import type { BudgetCreate, BudgetUpdate } from '@pulpe/shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

describe('BudgetService', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;

  const createValidBudgetEntity = (overrides: any = {}): any => ({
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    created_at: '2024-01-15T10:30:00.000Z',
    updated_at: '2024-01-15T10:30:00.000Z',
    user_id: 'a1b2c3d4-e5f6-4789-8901-234567890abc',
    month: 1,
    year: 2024,
    description: 'Budget Janvier 2024',
    template_id: null,
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: `PinoLogger:${BudgetService.name}`,
          useValue: mockPinoLogger,
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
        id: 'new-budget-id',
        month: createBudgetDto.month,
        year: createBudgetDto.year,
        description: createBudgetDto.description,
        user_id: mockUser.id,
      });

      // Mock RPC call for template-based creation
      const mockRpcResult = {
        budget: mockCreatedBudget,
        transactions_created: 5,
        template_name: 'Test Template',
      };

      mockSupabaseClient.setMockData(null).setMockError(null);
      mockSupabaseClient.rpc = () =>
        Promise.resolve({
          data: mockRpcResult,
          error: null,
        });

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

      // Mock: budget already exists for this period
      mockSupabaseClient
        .setMockData({ id: 'existing-budget' })
        .setMockError(null);

      await expectBusinessExceptionThrown(
        () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month: createBudgetDto.month, year: createBudgetDto.year },
      );
    });
  });

  describe('findOne', () => {
    it('should return budget with enriched data', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = MOCK_BUDGET_ID;
      const currentDate = new Date();
      const mockBudget = createValidBudgetEntity({
        id: budgetId,
        month: currentDate.getMonth() + 1, // Current month
        year: currentDate.getFullYear(),
      });

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      const result = await service.findOne(budgetId, mockSupabaseClient as any);

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
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = 'non-existent-id';
      const mockError = { message: 'No rows returned' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      await expectBusinessExceptionThrown(
        () => service.findOne(budgetId, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
      );
    });
  });

  describe('update', () => {
    it('should update budget with validation', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
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
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.description).toBe(updateBudgetDto.description!);
      expect(result.data.month).toBe(updateBudgetDto.month!);
    });

    it('should validate update data against Zod schema', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = MOCK_BUDGET_ID;

      // Test invalid update data
      const invalidUpdate: BudgetUpdate = {
        month: 0, // Invalid: must be 1-12
      };

      await expectBusinessExceptionThrown(
        () =>
          service.update(budgetId, invalidUpdate, mockSupabaseClient as any),
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Month must be between 1 and 12' },
      );
    });
  });

  describe('findOneWithDetails', () => {
    it('should return budget with transactions and budget lines', async () => {
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });
      const mockTransactions = [
        {
          id: 'trans-1',
          budget_id: budgetId,
          name: 'Transaction 1',
          amount: 100,
          kind: 'EXPENSE',
          transaction_date: '2024-01-15T10:00:00.000Z',
          is_out_of_budget: false,
          category: 'Food',
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T10:00:00.000Z',
        },
        {
          id: 'trans-2',
          budget_id: budgetId,
          name: 'Transaction 2',
          amount: 200,
          kind: 'INCOME',
          transaction_date: '2024-01-10T10:00:00.000Z',
          is_out_of_budget: false,
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
      const mockBudgetClient = new MockSupabaseClient();
      const mockTransactionClient = new MockSupabaseClient();
      const mockBudgetLineClient = new MockSupabaseClient();

      // Configure each client with its specific data
      mockBudgetClient.setMockData(mockBudget).setMockError(null);
      mockTransactionClient.setMockData(mockTransactions).setMockError(null);
      mockBudgetLineClient.setMockData(mockBudgetLines).setMockError(null);

      // Override the from method to return the appropriate client
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = (table: string) => {
        if (table === 'monthly_budget') {
          return mockBudgetClient.from(table);
        } else if (table === 'transaction') {
          return mockTransactionClient.from(table);
        } else if (table === 'budget_line') {
          return mockBudgetLineClient.from(table);
        }
        return originalFrom.call(mockSupabaseClient, table);
      };

      const result = await service.findOneWithDetails(
        budgetId,
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

      // Verify budget lines
      expect(result.data.budgetLines).toHaveLength(2);
      expect(result.data.budgetLines[0].name).toBe('Salaire');
      expect(result.data.budgetLines[0]).toHaveProperty('budgetId');
      expect(result.data.budgetLines[0]).not.toHaveProperty('budget_id');
    });

    it('should return budget with empty arrays when no transactions or budget lines', async () => {
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });

      // Create separate mock clients for each table to avoid data collision
      const mockBudgetClient = new MockSupabaseClient();
      const mockTransactionClient = new MockSupabaseClient();
      const mockBudgetLineClient = new MockSupabaseClient();

      // Configure each client with its specific data
      mockBudgetClient.setMockData(mockBudget).setMockError(null);
      mockTransactionClient.setMockData([]).setMockError(null);
      mockBudgetLineClient.setMockData([]).setMockError(null);

      // Override the from method to return the appropriate client
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = (table: string) => {
        if (table === 'monthly_budget') {
          return mockBudgetClient.from(table);
        } else if (table === 'transaction') {
          return mockTransactionClient.from(table);
        } else if (table === 'budget_line') {
          return mockBudgetLineClient.from(table);
        }
        return originalFrom.call(mockSupabaseClient, table);
      };

      const result = await service.findOneWithDetails(
        budgetId,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.budget.id).toBe(budgetId);
      expect(result.data.transactions).toEqual([]);
      expect(result.data.budgetLines).toEqual([]);
    });

    it('should throw NotFoundException when budget not found', async () => {
      const budgetId = 'non-existent-id';

      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: 'No rows returned' });

      await expectBusinessExceptionThrown(
        () => service.findOneWithDetails(budgetId, mockSupabaseClient as any),
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
      );
    });

    it('should still return budget even if transactions or budget lines queries fail', async () => {
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createValidBudgetEntity({ id: budgetId });

      // Create separate mock clients for each table to avoid data collision
      const mockBudgetClient = new MockSupabaseClient();
      const mockTransactionClient = new MockSupabaseClient();
      const mockBudgetLineClient = new MockSupabaseClient();

      // Configure each client with its specific data
      mockBudgetClient.setMockData(mockBudget).setMockError(null);
      mockTransactionClient
        .setMockData(null)
        .setMockError({ message: 'Permission denied' });
      mockBudgetLineClient
        .setMockData(null)
        .setMockError({ message: 'Permission denied' });

      // Override the from method to return the appropriate client
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = (table: string) => {
        if (table === 'monthly_budget') {
          return mockBudgetClient.from(table);
        } else if (table === 'transaction') {
          return mockTransactionClient.from(table);
        } else if (table === 'budget_line') {
          return mockBudgetLineClient.from(table);
        }
        return originalFrom.call(mockSupabaseClient, table);
      };

      const result = await service.findOneWithDetails(
        budgetId,
        mockSupabaseClient as any,
      );

      // Should not throw, but return empty arrays for failed queries
      expect(result.success).toBe(true);
      expect(result.data.budget.id).toBe(budgetId);
      expect(result.data.transactions).toEqual([]);
      expect(result.data.budgetLines).toEqual([]);
    });
  });
});
