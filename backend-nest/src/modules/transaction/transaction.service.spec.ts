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
} from '../../test/test-utils-simple';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const MOCK_BUDGET_ID = 'budget-123';
const MOCK_TRANSACTION_ID = 'transaction-456';

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
      calculateAndPersistEndingBalance: mock(() => Promise.resolve(100)),
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
        isOutOfBudget: false,
      };
      const mockCreatedTransaction = createMockTransactionEntity({
        budget_id: createTransactionDto.budgetId,
        name: createTransactionDto.name,
        amount: createTransactionDto.amount,
        kind: 'expense', // DB uses new enum
        is_out_of_budget: createTransactionDto.isOutOfBudget,
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
        isOutOfBudget: false,
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
        isOutOfBudget: false,
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
        isOutOfBudget: false,
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
        isOutOfBudget: false,
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
});
