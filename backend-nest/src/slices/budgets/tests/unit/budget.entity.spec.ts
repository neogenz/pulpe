import { describe, it, expect } from 'bun:test';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { DomainException } from '@shared/domain/exceptions/domain.exception';

describe('Budget Entity', () => {
  const validProps = {
    userId: 'user-123',
    period: BudgetPeriod.create(1, 2024).value!,
    description: 'January 2024 Budget',
    templateId: 'template-123',
  };

  describe('create', () => {
    it('should create a valid budget', () => {
      const result = Budget.create(validProps);

      expect(result.isOk()).toBe(true);
      expect(result.value?.userId).toBe(validProps.userId);
      expect(result.value?.period.equals(validProps.period)).toBe(true);
      expect(result.value?.description).toBe(validProps.description);
      expect(result.value?.templateId).toBe(validProps.templateId);
      expect(result.value?.id).toBeDefined();
      expect(result.value?.createdAt).toBeInstanceOf(Date);
      expect(result.value?.updatedAt).toBeInstanceOf(Date);
    });

    it('should create budget with specific id', () => {
      const id = 'budget-123';
      const result = Budget.create(validProps, id);

      expect(result.isOk()).toBe(true);
      expect(result.value?.id).toBe(id);
    });

    it('should fail with empty userId', () => {
      const result = Budget.create({ ...validProps, userId: '' });

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('User ID is required');
    });

    it('should fail with empty description', () => {
      const result = Budget.create({ ...validProps, description: '' });

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Description is required');
    });

    it('should fail with description too long', () => {
      const longDescription = 'a'.repeat(501);
      const result = Budget.create({
        ...validProps,
        description: longDescription,
      });

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Description too long');
    });

    it('should fail with empty templateId', () => {
      const result = Budget.create({ ...validProps, templateId: '' });

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Template ID is required');
    });
  });

  describe('updateDescription', () => {
    it('should update description successfully', async () => {
      const budget = Budget.create(validProps).value!;
      const newDescription = 'Updated description';

      // Add a small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = budget.updateDescription(newDescription);

      expect(result.isOk()).toBe(true);
      expect(budget.description).toBe(newDescription);
      expect(budget.updatedAt.getTime()).toBeGreaterThan(
        budget.createdAt.getTime(),
      );
    });

    it('should fail with empty description', () => {
      const budget = Budget.create(validProps).value!;

      const result = budget.updateDescription('');

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Description is required');
      expect(budget.description).toBe(validProps.description); // Should not change
    });

    it('should fail with description too long', () => {
      const budget = Budget.create(validProps).value!;
      const longDescription = 'a'.repeat(501);

      const result = budget.updateDescription(longDescription);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Description too long');
      expect(budget.description).toBe(validProps.description); // Should not change
    });
  });

  describe('updatePeriod', () => {
    it('should update period successfully', async () => {
      const budget = Budget.create(validProps).value!;
      const newPeriod = BudgetPeriod.create(2, 2024).value!;

      // Add a small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = budget.updatePeriod(newPeriod);

      expect(result.isOk()).toBe(true);
      expect(budget.period.equals(newPeriod)).toBe(true);
      expect(budget.updatedAt.getTime()).toBeGreaterThan(
        budget.createdAt.getTime(),
      );
    });

    it('should not update if period is the same', () => {
      const budget = Budget.create(validProps).value!;
      const samePeriod = BudgetPeriod.create(1, 2024).value!;
      const originalUpdatedAt = budget.updatedAt;

      const result = budget.updatePeriod(samePeriod);

      expect(result.isOk()).toBe(true);
      expect(budget.updatedAt).toBe(originalUpdatedAt); // Should not change
    });
  });

  describe('canBeDeleted', () => {
    it('should allow deletion of future budgets', () => {
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const budget = Budget.create({
        ...validProps,
        period: futurePeriod,
      }).value!;

      expect(budget.canBeDeleted()).toBe(true);
    });

    it('should allow deletion of current month budget', () => {
      const now = new Date();
      const currentPeriod = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      const budget = Budget.create({
        ...validProps,
        period: currentPeriod,
      }).value!;

      expect(budget.canBeDeleted()).toBe(true);
    });

    it('should not allow deletion of past budgets', () => {
      const pastPeriod = BudgetPeriod.create(1, 2020).value!;
      const budget = Budget.create({
        ...validProps,
        period: pastPeriod,
      }).value!;

      expect(budget.canBeDeleted()).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('should allow editing of future budgets', () => {
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const budget = Budget.create({
        ...validProps,
        period: futurePeriod,
      }).value!;

      expect(budget.isEditable()).toBe(true);
    });

    it('should allow editing of current month budget', () => {
      const now = new Date();
      const currentPeriod = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      const budget = Budget.create({
        ...validProps,
        period: currentPeriod,
      }).value!;

      expect(budget.isEditable()).toBe(true);
    });

    it('should not allow editing of past budgets', () => {
      const pastPeriod = BudgetPeriod.create(1, 2020).value!;
      const budget = Budget.create({
        ...validProps,
        period: pastPeriod,
      }).value!;

      expect(budget.isEditable()).toBe(false);
    });
  });

  describe('toSnapshot', () => {
    it('should return correct snapshot', () => {
      const budget = Budget.create(validProps).value!;
      const snapshot = budget.toSnapshot();

      expect(snapshot.id).toBe(budget.id);
      expect(snapshot.userId).toBe(budget.userId);
      expect(snapshot.month).toBe(budget.period.month);
      expect(snapshot.year).toBe(budget.period.year);
      expect(snapshot.description).toBe(budget.description);
      expect(snapshot.templateId).toBe(budget.templateId);
      expect(snapshot.createdAt).toBe(budget.createdAt);
      expect(snapshot.updatedAt).toBe(budget.updatedAt);
    });
  });
});
