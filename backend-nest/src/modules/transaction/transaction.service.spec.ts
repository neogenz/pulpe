import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TransactionService } from './transaction.service';
import { BudgetService } from '../budget/budget.service';
import { PinoLogger } from 'nestjs-pino';
import type { TransactionCreate, TransactionUpdate } from '@pulpe/shared';
import {
  createMockSupabaseClient,
  expectBusinessExceptionThrown,
  createMockAuthenticatedUser,
  createMockTransactionEntity,
  MockSupabaseClient,
} from '../../test/test-mocks';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const MOCK_BUDGET_ID = 'budget-123';
const MOCK_TRANSACTION_ID = 'transaction-456';

// Valid UUIDs for testing budgetLineId validation
const TEST_UUIDS = {
  BUDGET: '33333333-3333-4333-8333-333333333333',
  BUDGET_LINE: '44444444-4444-4444-8444-444444444444',
  BUDGET_LINE_NONEXISTENT: '66666666-6666-4666-8666-666666666666',
  OTHER_BUDGET: '77777777-7777-4777-8777-777777777777',
};

describe('TransactionService', () => {
  let service: TransactionService;
  let mockLogger: Partial<PinoLogger>;
  let mockBudgetService: Partial<BudgetService>;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(() => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;
    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    };
    mockBudgetService = {
      recalculateBalances: mock(() => Promise.resolve()),
    };
    service = new TransactionService(
      mockLogger as PinoLogger,
      mockBudgetService as BudgetService,
    );
  });

  describe('findAll', () => {
    it('should return all transactions successfully', async () => {
      // Arrange
      const mockTransactions = [
        createMockTransactionEntity({ name: 'Transaction 1' }),
        createMockTransactionEntity({ name: 'Transaction 2' }),
      ];
      mockSupabaseClient.setMockData(mockTransactions);

      // Act
      const result = await service.findAll(mockSupabaseClient as any);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Transaction 1');
      expect(result.data[1].name).toBe('Transaction 2');
    });

    it('should handle empty transaction list', async () => {
      // Arrange
      mockSupabaseClient.setMockData([]);

      // Act
      const result = await service.findAll(mockSupabaseClient as any);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database error gracefully', async () => {
      // Arrange
      const mockError = { message: 'Database error' };
      mockSupabaseClient.reset().setMockError(mockError);

      // Act & Assert
      await expectBusinessExceptionThrown(
        () => service.findAll(mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
      );
    });
  });

  describe('create', () => {
    it('should create transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 100,
        kind: 'expense',
      };
      const mockCreatedTransaction = createMockTransactionEntity({
        budget_id: createTransactionDto.budgetId,
        name: createTransactionDto.name,
        amount: createTransactionDto.amount,
        kind: 'expense', // DB uses new enum
      });

      mockSupabaseClient.reset().setMockData(mockCreatedTransaction);

      // Act
      const result = await service.create(
        createTransactionDto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && 'name' in result.data) {
        expect(result.data.name).toBe('Test Transaction');
        expect(result.data.amount).toBe(100);
      }
    });

    it('should validate required fields during creation', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const invalidDto: TransactionCreate = {
        budgetId: '',
        name: 'Test',
        amount: 100,
        kind: 'expense',
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () => service.create(invalidDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.REQUIRED_DATA_MISSING,
        { fields: ['budgetId'] },
      );
    });

    it('should validate amount is positive', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const invalidDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test',
        amount: -50,
        kind: 'expense',
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () => service.create(invalidDto, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Amount must be greater than 0' },
      );
    });

    it('should handle database creation error', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 100,
        kind: 'expense',
      };
      const mockError = { message: 'Database insert failed' };

      mockSupabaseClient.reset().setMockError(mockError);

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.create(
            createTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
      );
    });

    it('should handle unexpected errors during transaction creation', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 150,
        kind: 'expense',
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Unexpected database error');
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.create(
            createTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('findOne', () => {
    it('should return specific transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockTransaction = createMockTransactionEntity({
        id: MOCK_TRANSACTION_ID,
      });
      mockSupabaseClient.reset().setMockData(mockTransaction);

      // Act
      const result = await service.findOne(
        MOCK_TRANSACTION_ID,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && 'id' in result.data) {
        expect(result.data.id).toBe(MOCK_TRANSACTION_ID);
      }
    });

    it('should throw NotFoundException when transaction not found', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient.reset().setMockError({ message: 'Not found' });

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.findOne('non-existent', mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
      );
    });

    it('should handle database error when finding transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'transaction-123';

      // Force an unexpected error
      mockSupabaseClient.from = () => {
        throw new Error('Unexpected error');
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.findOne(transactionId, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
      );
    });
  });

  describe('update', () => {
    it('should update transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const updateData: TransactionUpdate = {
        name: 'Updated Transaction',
        amount: 200,
      };
      const mockUpdatedTransaction = createMockTransactionEntity({
        name: updateData.name,
        amount: updateData.amount,
      });

      mockSupabaseClient.reset().setMockData(mockUpdatedTransaction);

      // Act
      const result = await service.update(
        MOCK_TRANSACTION_ID,
        updateData,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && 'name' in result.data) {
        expect(result.data.name).toBe('Updated Transaction');
        expect(result.data.amount).toBe(200);
      }
    });

    it('should throw NotFoundException when updating non-existent transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const updateData: TransactionUpdate = {
        name: 'Updated Transaction',
      };
      const mockError = { message: 'Not found' };

      mockSupabaseClient.reset().setMockError(mockError);

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.update(
            'non-existent',
            updateData,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
      );
    });

    it('should handle unexpected errors during transaction update', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'transaction-123';
      const updateData: TransactionUpdate = {
        name: 'Updated Transaction',
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Unexpected database error');
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.update(
            transactionId,
            updateData,
            mockUser,
            mockSupabaseClient as any,
          ),
        ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('remove', () => {
    it('should delete transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'transaction-123';
      mockSupabaseClient.reset();

      // Act
      const result = await service.remove(
        transactionId,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Transaction deleted successfully',
      });
    });

    it('should throw NotFoundException when deleting non-existent transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'non-existent-id';
      const mockError = { message: 'No rows affected' };
      mockSupabaseClient.reset().setMockError(mockError);

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.remove(transactionId, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
      );
    });

    it('should handle unexpected errors during transaction deletion', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'transaction-123';

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Unexpected database error');
      };

      // Act & Assert
      await expectBusinessExceptionThrown(
        () =>
          service.remove(transactionId, mockUser, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED,
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('findByBudgetId', () => {
    it('should return all transactions for specific budget successfully', async () => {
      // Arrange
      const mockTransactions = [
        createMockTransactionEntity({ budget_id: MOCK_BUDGET_ID }),
        createMockTransactionEntity({ budget_id: MOCK_BUDGET_ID }),
      ];
      mockSupabaseClient.setMockData(mockTransactions);

      // Act
      const result = await service.findByBudgetId(
        MOCK_BUDGET_ID,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should handle database error gracefully when finding by budget', async () => {
      // Arrange
      const mockError = { message: 'Database error' };
      mockSupabaseClient.reset().setMockError(mockError);

      // Act & Assert
      await expectBusinessExceptionThrown(
        () => service.findByBudgetId(MOCK_BUDGET_ID, mockSupabaseClient as any),
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
      );
    });

    it('should handle empty transaction list for budget', async () => {
      // Arrange
      mockSupabaseClient.setMockData([]);

      // Act
      const result = await service.findByBudgetId(
        MOCK_BUDGET_ID,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle null data from database for budget transactions', async () => {
      // Arrange
      mockSupabaseClient.setMockData(null);

      // Act
      const result = await service.findByBudgetId(
        MOCK_BUDGET_ID,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('budgetLineId validation', () => {
    describe('create with budgetLineId', () => {
      it('should create transaction without budgetLineId (backward compatible)', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const createDto: TransactionCreate = {
          budgetId: TEST_UUIDS.BUDGET,
          name: 'Free Transaction',
          amount: 100,
          kind: 'expense',
        };
        const mockCreatedTransaction = createMockTransactionEntity({
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: null,
          name: createDto.name,
          amount: createDto.amount,
          kind: 'expense',
        });
        mockSupabaseClient.reset().setMockData(mockCreatedTransaction);

        // Act
        const result = await service.create(
          createDto,
          mockUser,
          mockSupabaseClient as any,
        );

        // Assert
        expect(result.success).toBe(true);
        expect(
          result.data &&
            'budgetLineId' in result.data &&
            result.data.budgetLineId,
        ).toBeNull();
      });

      it('should create transaction with valid budgetLineId and matching kind', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const createDto: TransactionCreate = {
          budgetId: TEST_UUIDS.BUDGET,
          budgetLineId: TEST_UUIDS.BUDGET_LINE,
          name: 'Allocated Transaction',
          amount: 100,
          kind: 'expense',
        };

        // Mock budget_line lookup to return a matching line
        const mockBudgetLine = {
          id: TEST_UUIDS.BUDGET_LINE,
          budget_id: TEST_UUIDS.BUDGET,
          kind: 'expense',
          name: 'Groceries',
          amount: 500,
        };

        // Setup: First call returns budget_line, second call returns created transaction
        const originalFrom = mockSupabaseClient.from;
        mockSupabaseClient.from = (table: string) => {
          if (table === 'budget_line') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({ data: mockBudgetLine, error: null }),
                }),
              }),
            };
          }
          return originalFrom.call(mockSupabaseClient, table);
        };

        const mockCreatedTransaction = createMockTransactionEntity({
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: TEST_UUIDS.BUDGET_LINE,
          name: createDto.name,
          amount: createDto.amount,
          kind: 'expense',
        });
        mockSupabaseClient.setMockData(mockCreatedTransaction);

        // Act
        const result = await service.create(
          createDto,
          mockUser,
          mockSupabaseClient as any,
        );

        // Assert
        expect(result.success).toBe(true);
        if (result.data && 'budgetLineId' in result.data) {
          expect(result.data.budgetLineId).toBe(TEST_UUIDS.BUDGET_LINE);
        }

        // Restore
        mockSupabaseClient.from = originalFrom;
      });

      it('should throw error when budgetLineId does not exist', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const createDto: TransactionCreate = {
          budgetId: TEST_UUIDS.BUDGET,
          budgetLineId: TEST_UUIDS.BUDGET_LINE_NONEXISTENT,
          name: 'Transaction',
          amount: 100,
          kind: 'expense',
        };

        // Mock budget_line lookup to return not found
        const originalFrom = mockSupabaseClient.from;
        mockSupabaseClient.from = (table: string) => {
          if (table === 'budget_line') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'Not found' },
                    }),
                }),
              }),
            };
          }
          return originalFrom.call(mockSupabaseClient, table);
        };

        // Act & Assert
        await expectBusinessExceptionThrown(
          () => service.create(createDto, mockUser, mockSupabaseClient as any),
          ERROR_DEFINITIONS.TRANSACTION_BUDGET_LINE_NOT_FOUND,
        );

        // Restore
        mockSupabaseClient.from = originalFrom;
      });

      it('should throw error when budgetLineId belongs to different budget', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const createDto: TransactionCreate = {
          budgetId: TEST_UUIDS.BUDGET,
          budgetLineId: TEST_UUIDS.BUDGET_LINE,
          name: 'Transaction',
          amount: 100,
          kind: 'expense',
        };

        // Mock budget_line lookup to return line from different budget
        const mockBudgetLine = {
          id: TEST_UUIDS.BUDGET_LINE,
          budget_id: TEST_UUIDS.OTHER_BUDGET, // Different budget!
          kind: 'expense',
          name: 'Other Budget Line',
          amount: 500,
        };

        const originalFrom = mockSupabaseClient.from;
        mockSupabaseClient.from = (table: string) => {
          if (table === 'budget_line') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({ data: mockBudgetLine, error: null }),
                }),
              }),
            };
          }
          return originalFrom.call(mockSupabaseClient, table);
        };

        // Act & Assert
        await expectBusinessExceptionThrown(
          () => service.create(createDto, mockUser, mockSupabaseClient as any),
          ERROR_DEFINITIONS.TRANSACTION_BUDGET_LINE_MISMATCH,
        );

        // Restore
        mockSupabaseClient.from = originalFrom;
      });

      it('should throw error when transaction kind does not match budget line kind', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const createDto: TransactionCreate = {
          budgetId: TEST_UUIDS.BUDGET,
          budgetLineId: TEST_UUIDS.BUDGET_LINE,
          name: 'Transaction',
          amount: 100,
          kind: 'expense', // Transaction is expense
        };

        // Mock budget_line lookup to return line with different kind
        const mockBudgetLine = {
          id: TEST_UUIDS.BUDGET_LINE,
          budget_id: TEST_UUIDS.BUDGET,
          kind: 'income', // Budget line is income!
          name: 'Salary',
          amount: 5000,
        };

        const originalFrom = mockSupabaseClient.from;
        mockSupabaseClient.from = (table: string) => {
          if (table === 'budget_line') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({ data: mockBudgetLine, error: null }),
                }),
              }),
            };
          }
          return originalFrom.call(mockSupabaseClient, table);
        };

        // Act & Assert
        await expectBusinessExceptionThrown(
          () => service.create(createDto, mockUser, mockSupabaseClient as any),
          ERROR_DEFINITIONS.TRANSACTION_BUDGET_LINE_KIND_MISMATCH,
        );

        // Restore
        mockSupabaseClient.from = originalFrom;
      });
    });

    describe('update with budgetLineId', () => {
      it('should update transaction to allocate to a budget line', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const updateDto: TransactionUpdate = {
          budgetLineId: TEST_UUIDS.BUDGET_LINE,
        };

        // Mock budget_line lookup to return matching line
        const mockBudgetLine = {
          id: TEST_UUIDS.BUDGET_LINE,
          budget_id: TEST_UUIDS.BUDGET,
          kind: 'expense',
          name: 'Groceries',
          amount: 500,
        };

        // Mock existing transaction to get its budget_id and kind
        const existingTransaction = createMockTransactionEntity({
          id: MOCK_TRANSACTION_ID,
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: null,
          kind: 'expense',
        });

        const updatedTransaction = createMockTransactionEntity({
          id: MOCK_TRANSACTION_ID,
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: TEST_UUIDS.BUDGET_LINE,
          kind: 'expense',
        });

        let selectCallCount = 0;
        const originalFrom = mockSupabaseClient.from;
        mockSupabaseClient.from = (table: string) => {
          if (table === 'budget_line') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({ data: mockBudgetLine, error: null }),
                }),
              }),
            };
          }
          if (table === 'transaction') {
            return {
              select: () => ({
                eq: () => ({
                  single: () => {
                    selectCallCount++;
                    // First select is to get existing transaction, second is after update
                    return Promise.resolve({
                      data:
                        selectCallCount === 1
                          ? existingTransaction
                          : updatedTransaction,
                      error: null,
                    });
                  },
                }),
              }),
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: updatedTransaction,
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          return originalFrom.call(mockSupabaseClient, table);
        };

        // Act
        const result = await service.update(
          MOCK_TRANSACTION_ID,
          updateDto,
          mockUser,
          mockSupabaseClient as any,
        );

        // Assert
        expect(result.success).toBe(true);
        if (result.data && 'budgetLineId' in result.data) {
          expect(result.data.budgetLineId).toBe(TEST_UUIDS.BUDGET_LINE);
        }

        // Restore
        mockSupabaseClient.from = originalFrom;
      });

      it('should update transaction to unallocate (set budgetLineId to null)', async () => {
        // Arrange
        const mockUser = createMockAuthenticatedUser();
        const updateDto: TransactionUpdate = {
          budgetLineId: null, // Unallocate
        };

        const updatedTransaction = createMockTransactionEntity({
          id: MOCK_TRANSACTION_ID,
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: null,
          kind: 'expense',
        });

        mockSupabaseClient.reset().setMockData(updatedTransaction);

        // Act
        const result = await service.update(
          MOCK_TRANSACTION_ID,
          updateDto,
          mockUser,
          mockSupabaseClient as any,
        );

        // Assert
        expect(result.success).toBe(true);
        if (result.data && 'budgetLineId' in result.data) {
          expect(result.data.budgetLineId).toBeNull();
        }
      });
    });
  });
});
