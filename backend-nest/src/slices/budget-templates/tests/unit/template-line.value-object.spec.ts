import { describe, it, expect } from 'bun:test';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';

describe('TemplateLine Value Object', () => {
  describe('create', () => {
    it('should create a valid income line', () => {
      const result = TemplateLine.create({
        name: 'Salary',
        amount: 5000,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: 'Monthly salary',
      });

      expect(result.isSuccess).toBe(true);
      const line = result.getValue();
      expect(line.name).toBe('Salary');
      expect(line.amount).toBe(5000);
      expect(line.kind).toBe('INCOME');
      expect(line.recurrence).toBe('fixed');
      expect(line.description).toBe('Monthly salary');
      expect(line.isIncome()).toBe(true);
      expect(line.isExpense()).toBe(false);
    });

    it('should create a valid fixed expense line', () => {
      const result = TemplateLine.create({
        name: 'Rent',
        amount: 1200,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
        description: null,
      });

      expect(result.isSuccess).toBe(true);
      const line = result.getValue();
      expect(line.kind).toBe('FIXED_EXPENSE');
      expect(line.description).toBeNull();
      expect(line.isIncome()).toBe(false);
      expect(line.isExpense()).toBe(true);
    });

    it('should create a valid variable expense line', () => {
      const result = TemplateLine.create({
        name: 'Groceries',
        amount: 500,
        kind: 'VARIABLE_EXPENSE',
        recurrence: 'envelope',
        description: 'Food and household items',
      });

      expect(result.isSuccess).toBe(true);
      const line = result.getValue();
      expect(line.kind).toBe('VARIABLE_EXPENSE');
      expect(line.recurrence).toBe('envelope');
      expect(line.isExpense()).toBe(true);
    });

    it('should generate unique IDs for different lines', () => {
      const line1 = TemplateLine.create({
        name: 'Line 1',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const line2 = TemplateLine.create({
        name: 'Line 2',
        amount: 200,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      expect(line1.id).not.toBe(line2.id);
    });

    it('should use provided ID when specified', () => {
      const customId = 'custom-id-123';
      const result = TemplateLine.create({
        id: customId,
        name: 'Test Line',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().id).toBe(customId);
    });

    it('should fail with empty name', () => {
      const result = TemplateLine.create({
        name: '',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_NAME');
    });

    it('should fail with negative amount', () => {
      const result = TemplateLine.create({
        name: 'Invalid',
        amount: -100,
        kind: 'INCOME',
        recurrence: 'fixed',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
    });

    it('should fail with invalid kind', () => {
      const result = TemplateLine.create({
        name: 'Invalid',
        amount: 100,
        kind: 'INVALID' as any,
        recurrence: 'fixed',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_KIND');
    });

    it('should fail with invalid recurrence', () => {
      const result = TemplateLine.create({
        name: 'Invalid',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'invalid' as any,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_RECURRENCE');
    });

    it('should fail with name too long', () => {
      const longName = 'a'.repeat(101);
      const result = TemplateLine.create({
        name: longName,
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('NAME_TOO_LONG');
    });

    it('should fail with description too long', () => {
      const longDescription = 'a'.repeat(501);
      const result = TemplateLine.create({
        name: 'Valid',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: longDescription,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DESCRIPTION_TOO_LONG');
    });
  });

  describe('update', () => {
    it('should update name only', () => {
      const original = TemplateLine.create({
        name: 'Original',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: 'Original desc',
      }).getValue();

      const result = original.update({ name: 'Updated' });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.name).toBe('Updated');
      expect(updated.amount).toBe(100);
      expect(updated.kind).toBe('INCOME');
    });

    it('should update amount to zero', () => {
      const original = TemplateLine.create({
        name: 'Test',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const result = original.update({ amount: 0 });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(0);
    });

    it('should update kind from income to expense', () => {
      const original = TemplateLine.create({
        name: 'Test',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const result = original.update({ kind: 'FIXED_EXPENSE' });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.kind).toBe('FIXED_EXPENSE');
      expect(updated.isIncome()).toBe(false);
      expect(updated.isExpense()).toBe(true);
    });

    it('should update all fields', () => {
      const original = TemplateLine.create({
        name: 'Original',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: 'Original',
      }).getValue();

      const result = original.update({
        name: 'New Name',
        amount: 200,
        kind: 'VARIABLE_EXPENSE',
        recurrence: 'envelope',
        description: 'New description',
      });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.name).toBe('New Name');
      expect(updated.amount).toBe(200);
      expect(updated.kind).toBe('VARIABLE_EXPENSE');
      expect(updated.recurrence).toBe('envelope');
      expect(updated.description).toBe('New description');
    });

    it('should preserve ID after update', () => {
      const original = TemplateLine.create({
        name: 'Test',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const originalId = original.id;
      const updated = original.update({ name: 'Updated' }).getValue();

      expect(updated.id).toBe(originalId);
    });

    it('should fail update with invalid data', () => {
      const original = TemplateLine.create({
        name: 'Valid',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const result = original.update({ amount: -50 });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
    });
  });

  describe('equals', () => {
    it('should return true for identical lines', () => {
      const props = {
        id: 'same-id',
        name: 'Same Line',
        amount: 100,
        kind: 'INCOME' as const,
        recurrence: 'fixed' as const,
        description: 'Same description',
      };

      const line1 = TemplateLine.create(props).getValue();
      const line2 = TemplateLine.create(props).getValue();

      expect(line1.equals(line2)).toBe(true);
    });

    it('should return false for lines with different IDs', () => {
      const line1 = TemplateLine.create({
        name: 'Same',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      const line2 = TemplateLine.create({
        name: 'Same',
        amount: 100,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      expect(line1.equals(line2)).toBe(false);
    });
  });

  describe('business methods', () => {
    it('should correctly identify income lines', () => {
      const income = TemplateLine.create({
        name: 'Salary',
        amount: 5000,
        kind: 'INCOME',
        recurrence: 'fixed',
      }).getValue();

      expect(income.isIncome()).toBe(true);
      expect(income.isExpense()).toBe(false);
    });

    it('should correctly identify expense lines', () => {
      const fixedExpense = TemplateLine.create({
        name: 'Rent',
        amount: 1000,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
      }).getValue();

      const variableExpense = TemplateLine.create({
        name: 'Food',
        amount: 500,
        kind: 'VARIABLE_EXPENSE',
        recurrence: 'envelope',
      }).getValue();

      expect(fixedExpense.isExpense()).toBe(true);
      expect(fixedExpense.isIncome()).toBe(false);
      expect(variableExpense.isExpense()).toBe(true);
      expect(variableExpense.isIncome()).toBe(false);
    });
  });
});
