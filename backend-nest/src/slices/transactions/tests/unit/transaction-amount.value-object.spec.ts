import { describe, it, expect } from 'bun:test';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';

describe('TransactionAmount Value Object', () => {
  describe('create', () => {
    it('should create a valid amount', () => {
      // Act
      const result = TransactionAmount.create(100.5);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(100.5);
    });

    it('should round to 2 decimal places', () => {
      // Act
      const result = TransactionAmount.create(100.555);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(100.56);
    });

    it('should fail with NaN', () => {
      // Act
      const result = TransactionAmount.create(NaN);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION_AMOUNT');
    });

    it('should fail with amount too small', () => {
      // Act
      const result = TransactionAmount.create(0);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION_AMOUNT');
      expect(result.error?.message).toBe('Amount too small');
    });

    it('should fail with amount too large', () => {
      // Act
      const result = TransactionAmount.create(1000001);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_TRANSACTION_AMOUNT');
      expect(result.error?.message).toBe('Amount too large');
    });

    it('should accept minimum valid amount', () => {
      // Act
      const result = TransactionAmount.create(0.01);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(0.01);
    });

    it('should accept maximum valid amount', () => {
      // Act
      const result = TransactionAmount.create(1000000);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(1000000);
    });
  });

  describe('equality', () => {
    it('should return true for equal amounts', () => {
      // Arrange
      const amount1 = TransactionAmount.create(100.5).value!;
      const amount2 = TransactionAmount.create(100.5).value!;

      // Act & Assert
      expect(amount1.equals(amount2)).toBe(true);
    });

    it('should return false for different amounts', () => {
      // Arrange
      const amount1 = TransactionAmount.create(100.5).value!;
      const amount2 = TransactionAmount.create(100.51).value!;

      // Act & Assert
      expect(amount1.equals(amount2)).toBe(false);
    });
  });

  describe('comparison', () => {
    it('should correctly compare greater than', () => {
      // Arrange
      const amount1 = TransactionAmount.create(200).value!;
      const amount2 = TransactionAmount.create(100).value!;

      // Act & Assert
      expect(amount1.isGreaterThan(amount2)).toBe(true);
      expect(amount2.isGreaterThan(amount1)).toBe(false);
    });

    it('should correctly compare less than', () => {
      // Arrange
      const amount1 = TransactionAmount.create(100).value!;
      const amount2 = TransactionAmount.create(200).value!;

      // Act & Assert
      expect(amount1.isLessThan(amount2)).toBe(true);
      expect(amount2.isLessThan(amount1)).toBe(false);
    });
  });

  describe('arithmetic operations', () => {
    it('should add amounts correctly', () => {
      // Arrange
      const amount1 = TransactionAmount.create(100.5).value!;
      const amount2 = TransactionAmount.create(50.25).value!;

      // Act
      const result = amount1.add(amount2);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(150.75);
    });

    it('should fail adding if result exceeds maximum', () => {
      // Arrange
      const amount1 = TransactionAmount.create(900000).value!;
      const amount2 = TransactionAmount.create(200000).value!;

      // Act
      const result = amount1.add(amount2);

      // Assert
      expect(result.isFail()).toBe(true);
    });

    it('should subtract amounts correctly', () => {
      // Arrange
      const amount1 = TransactionAmount.create(100.5).value!;
      const amount2 = TransactionAmount.create(50.25).value!;

      // Act
      const result = amount1.subtract(amount2);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(50.25);
    });

    it('should fail subtracting if result is negative', () => {
      // Arrange
      const amount1 = TransactionAmount.create(50).value!;
      const amount2 = TransactionAmount.create(100).value!;

      // Act
      const result = amount1.subtract(amount2);

      // Assert
      expect(result.isFail()).toBe(true);
    });

    it('should multiply amount correctly', () => {
      // Arrange
      const amount = TransactionAmount.create(100).value!;

      // Act
      const result = amount.multiply(1.5);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value!.value).toBe(150);
    });

    it('should fail multiplying if result exceeds maximum', () => {
      // Arrange
      const amount = TransactionAmount.create(500000).value!;

      // Act
      const result = amount.multiply(3);

      // Assert
      expect(result.isFail()).toBe(true);
    });
  });

  describe('formatting', () => {
    it('should format as string with 2 decimal places', () => {
      // Arrange
      const amount = TransactionAmount.create(100.5).value!;

      // Act & Assert
      expect(amount.toString()).toBe('100.50');
    });

    it('should return numeric value for JSON serialization', () => {
      // Arrange
      const amount = TransactionAmount.create(100.75).value!;

      // Act & Assert
      expect(amount.toJSON()).toBe(100.75);
    });
  });
});
