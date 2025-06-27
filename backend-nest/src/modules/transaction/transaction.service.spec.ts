import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionMapper } from './transaction.mapper';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockTransactionDbEntity,
  expectSuccessResponse,
  expectErrorThrown,
  MOCK_USER_ID as _MOCK_USER_ID,
  MOCK_BUDGET_ID,
  MOCK_TRANSACTION_ID,
  MockSupabaseClient,
} from '../../test/test-utils';
import type { TransactionCreate, TransactionUpdate } from '@pulpe/shared';

describe('TransactionService', () => {
  let service: TransactionService;
  let _transactionMapper: TransactionMapper;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockTransactionMapper = {
      toApiList: (data: any[]) =>
        data.map((item) => ({ ...item, mappedToApi: true })),
      toApi: (data: any) => ({ ...data, mappedToApi: true }),
      toDbCreate: (data: any, userId: string) => ({
        ...data,
        user_id: userId,
        dbCreated: true,
      }),
      toDbUpdate: (data: any) => ({ ...data, dbUpdated: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionMapper,
          useValue: mockTransactionMapper,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    _transactionMapper = module.get<TransactionMapper>(TransactionMapper);
  });

  describe('findByBudgetId', () => {
    it('should return all transactions for specific budget successfully', async () => {
      // Arrange
      const _mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockTransactions = [
        createMockTransactionDbEntity(),
        createMockTransactionDbEntity({
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Transaction 2',
        }),
      ];

      mockSupabaseClient.setMockData(mockTransactions).setMockError(null);

      // Act
      const result = await service.findByBudgetId(
        budgetId,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('mappedToApi', true);
    });

    it('should handle database error gracefully when finding by budget', async () => {
      // Arrange
      const _mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockError = { message: 'Database connection failed' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () => service.findByBudgetId(budgetId, mockSupabaseClient as any),
        InternalServerErrorException,
        'Erreur lors de la récupération des transactions',
      );
    });

    it('should handle empty transaction list for budget', async () => {
      // Arrange
      const _mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      mockSupabaseClient.setMockData([]).setMockError(null);

      // Act
      const result = await service.findByBudgetId(
        budgetId,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });

    it('should handle null data from database for budget transactions', async () => {
      // Arrange
      const _mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      mockSupabaseClient.setMockData(null).setMockError(null);

      // Act
      const result = await service.findByBudgetId(
        budgetId,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 150,
        expenseType: 'fixed',
        type: 'expense',
        isRecurring: false,
      };
      const mockCreatedTransaction = createMockTransactionDbEntity();

      mockSupabaseClient.setMockData(mockCreatedTransaction).setMockError(null);

      // Act
      const result = await service.create(
        createTransactionDto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
    });

    it('should handle database creation error', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 150,
        expenseType: 'fixed',
        type: 'expense',
        isRecurring: false,
      };
      const mockError = { message: 'Foreign key constraint violation' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.create(
            createTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        BadRequestException,
        'Erreur lors de la création de la transaction',
      );
    });

    it('should handle unexpected errors during transaction creation', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createTransactionDto: TransactionCreate = {
        budgetId: MOCK_BUDGET_ID,
        name: 'Test Transaction',
        amount: 150,
        expenseType: 'fixed',
        type: 'expense',
        isRecurring: false,
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Unexpected database error');
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.create(
            createTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        InternalServerErrorException,
        'Erreur interne du serveur',
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('findOne', () => {
    it('should return specific transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;
      const mockTransaction = createMockTransactionDbEntity();

      mockSupabaseClient.setMockData(mockTransaction).setMockError(null);

      // Act
      const result = await service.findOne(
        transactionId,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'non-existent-id';
      const mockError = { message: 'No rows returned' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.findOne(transactionId, mockUser, mockSupabaseClient as any),
        NotFoundException,
        'Transaction introuvable ou accès non autorisé',
      );
    });

    it('should handle database error when finding transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;

      // Mock a rejected promise to simulate database error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Database connection error');
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.findOne(transactionId, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        'Erreur interne du serveur',
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('update', () => {
    it('should update transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;
      const updateTransactionDto: TransactionUpdate = {
        name: 'Updated Transaction',
        amount: 200,
      };
      const mockUpdatedTransaction =
        createMockTransactionDbEntity(updateTransactionDto);

      mockSupabaseClient.setMockData(mockUpdatedTransaction).setMockError(null);

      // Act
      const result = await service.update(
        transactionId,
        updateTransactionDto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
    });

    it('should throw NotFoundException when updating non-existent transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'non-existent-id';
      const updateTransactionDto: TransactionUpdate = {
        name: 'Updated Transaction',
      };
      const mockError = { message: 'No rows returned' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.update(
            transactionId,
            updateTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        NotFoundException,
        'Transaction introuvable ou modification non autorisée',
      );
    });

    it('should handle unexpected errors during transaction update', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;
      const updateTransactionDto: TransactionUpdate = {
        name: 'Updated Transaction',
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Database timeout');
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.update(
            transactionId,
            updateTransactionDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        InternalServerErrorException,
        'Erreur interne du serveur',
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe('remove', () => {
    it('should delete transaction successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;

      mockSupabaseClient.setMockError(null);

      // Act
      const result = await service.remove(
        transactionId,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Transaction supprimée avec succès',
      });
    });

    it('should throw NotFoundException when deleting non-existent transaction', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = 'non-existent-id';
      const mockError = { message: 'No rows affected' };

      mockSupabaseClient.setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.remove(transactionId, mockUser, mockSupabaseClient as any),
        NotFoundException,
        'Transaction introuvable ou suppression non autorisée',
      );
    });

    it('should handle unexpected errors during transaction deletion', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const transactionId = MOCK_TRANSACTION_ID;

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error('Database lock timeout');
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.remove(transactionId, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        'Erreur interne du serveur',
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });
});
