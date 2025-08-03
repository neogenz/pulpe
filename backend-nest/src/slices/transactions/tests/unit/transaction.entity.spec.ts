import { describe, it, expect, beforeEach } from 'bun:test';
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';

describe('Transaction Entity', () => {
  describe('create', () => {
    it('should create a valid transaction', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100.5);
      expect(amountResult.isOk()).toBe(true);

      const props = {
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'Grocery Shopping',
        kind: 'expense' as const,
        transactionDate: new Date('2024-01-15'),
        isOutOfBudget: false,
        category: 'Food',
      };

      // Act
      const result = Transaction.create(props);

      // Assert
      expect(result.isOk()).toBe(true);
      const transaction = result.value!;
      expect(transaction.budgetId).toBe(props.budgetId);
      expect(transaction.amount.value).toBe(100.5);
      expect(transaction.name).toBe(props.name);
      expect(transaction.kind).toBe(props.kind);
      expect(transaction.transactionDate).toEqual(props.transactionDate);
      expect(transaction.isOutOfBudget).toBe(props.isOutOfBudget);
      expect(transaction.category).toBe(props.category);
    });

    it('should fail with empty budget ID', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100);
      const props = {
        budgetId: '',
        amount: amountResult.value!,
        name: 'Test',
        kind: 'expense' as const,
        transactionDate: new Date(),
        isOutOfBudget: false,
        category: null,
      };

      // Act
      const result = Transaction.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION');
    });

    it('should fail with empty name', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100);
      const props = {
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: '',
        kind: 'expense' as const,
        transactionDate: new Date(),
        isOutOfBudget: false,
        category: null,
      };

      // Act
      const result = Transaction.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION');
    });

    it('should fail with name too long', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100);
      const props = {
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'a'.repeat(101),
        kind: 'expense' as const,
        transactionDate: new Date(),
        isOutOfBudget: false,
        category: null,
      };

      // Act
      const result = Transaction.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION');
    });

    it('should fail with invalid kind', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100);
      const props = {
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'Test',
        kind: 'invalid' as any,
        transactionDate: new Date(),
        isOutOfBudget: false,
        category: null,
      };

      // Act
      const result = Transaction.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION');
    });
  });

  describe('update methods', () => {
    let transaction: Transaction;

    beforeEach(() => {
      const amountResult = TransactionAmount.create(100);
      const result = Transaction.create({
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'Test',
        kind: 'expense',
        transactionDate: new Date(),
        isOutOfBudget: false,
        category: 'Food',
      });
      transaction = result.value!;
    });

    it('should update amount', () => {
      // Arrange
      const newAmountResult = TransactionAmount.create(200);

      // Act
      const result = transaction.updateAmount(newAmountResult.value!);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(transaction.amount.value).toBe(200);
    });

    it('should update name', () => {
      // Act
      const result = transaction.updateName('Updated Name');

      // Assert
      expect(result.isOk()).toBe(true);
      expect(transaction.name).toBe('Updated Name');
    });

    it('should fail updating with empty name', () => {
      // Act
      const result = transaction.updateName('');

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION_UPDATE');
    });

    it('should toggle out of budget status', () => {
      // Act
      const result = transaction.toggleOutOfBudget();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(transaction.isOutOfBudget).toBe(true);
    });

    it('should clear category when marked as out of budget', () => {
      // Act
      const result = transaction.markAsOutOfBudget();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(transaction.isOutOfBudget).toBe(true);
      expect(transaction.category).toBeNull();
    });

    it('should allow categorization when marked as in budget', () => {
      // Arrange
      transaction.markAsOutOfBudget();

      // Act
      transaction.markAsInBudget();

      // Assert
      expect(transaction.canBeCategorized()).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should not allow categorization for out of budget transactions', () => {
      // Arrange
      const amountResult = TransactionAmount.create(100);
      const result = Transaction.create({
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'Test',
        kind: 'expense',
        transactionDate: new Date(),
        isOutOfBudget: true,
        category: null,
      });
      const transaction = result.value!;

      // Act & Assert
      expect(transaction.canBeCategorized()).toBe(false);
    });
  });

  describe('toSnapshot', () => {
    it('should return a complete snapshot', () => {
      // Arrange
      const amountResult = TransactionAmount.create(150.75);
      const transactionDate = new Date('2024-01-15');
      const result = Transaction.create({
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: amountResult.value!,
        name: 'Test Transaction',
        kind: 'income',
        transactionDate,
        isOutOfBudget: false,
        category: 'Salary',
      });
      const transaction = result.value!;

      // Act
      const snapshot = transaction.toSnapshot();

      // Assert
      expect(snapshot).toEqual({
        id: transaction.id,
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 150.75,
        name: 'Test Transaction',
        kind: 'income',
        transactionDate,
        isOutOfBudget: false,
        category: 'Salary',
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      });
    });
  });
});
