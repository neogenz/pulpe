import { describe, it, expect } from 'bun:test';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';

describe('BudgetLine Entity', () => {
  const createValidAmount = (value: number = 1500) => {
    return BudgetLineAmount.create(value).getValue();
  };

  const createValidCategory = (
    props?: Partial<{
      name: string;
      kind: 'fixed' | 'envelope' | 'goal';
      recurrence: 'monthly' | 'yearly' | 'one-time';
      isManuallyAdjusted: boolean;
    }>,
  ) => {
    return BudgetLineCategory.create({
      name: props?.name ?? 'Rent',
      kind: props?.kind ?? 'fixed',
      recurrence: props?.recurrence ?? 'monthly',
      isManuallyAdjusted: props?.isManuallyAdjusted ?? false,
    }).getValue();
  };

  const validProps = {
    budgetId: '123e4567-e89b-12d3-a456-426614174000',
    category: createValidCategory(),
    amount: createValidAmount(),
  };

  describe('create', () => {
    it('should create a valid budget line', () => {
      const result = BudgetLine.create(validProps);

      expect(result.isSuccess).toBe(true);
      const budgetLine = result.getValue();
      expect(budgetLine.budgetId).toBe(validProps.budgetId);
      expect(budgetLine.category).toBe(validProps.category);
      expect(budgetLine.amount).toBe(validProps.amount);
      expect(budgetLine.templateLineId).toBe(null);
      expect(budgetLine.savingsGoalId).toBe(null);
    });

    it('should create with template line ID', () => {
      const props = {
        ...validProps,
        templateLineId: 'template-123',
      };
      const result = BudgetLine.create(props);

      expect(result.isSuccess).toBe(true);
      const budgetLine = result.getValue();
      expect(budgetLine.templateLineId).toBe('template-123');
      expect(budgetLine.isFromTemplate()).toBe(true);
    });

    it('should create with savings goal ID', () => {
      const props = {
        ...validProps,
        savingsGoalId: 'goal-123',
      };
      const result = BudgetLine.create(props);

      expect(result.isSuccess).toBe(true);
      const budgetLine = result.getValue();
      expect(budgetLine.savingsGoalId).toBe('goal-123');
      expect(budgetLine.isLinkedToSavingsGoal()).toBe(true);
    });

    it('should fail when budget ID is empty', () => {
      const props = { ...validProps, budgetId: '' };
      const result = BudgetLine.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_BUDGET_LINE');
      expect(result.error.message).toBe('Budget ID is required');
    });

    it('should fail when both template line and savings goal are set', () => {
      const props = {
        ...validProps,
        templateLineId: 'template-123',
        savingsGoalId: 'goal-123',
      };
      const result = BudgetLine.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_BUDGET_LINE');
      expect(result.error.message).toBe(
        'Budget line cannot have both template line and savings goal',
      );
    });

    it('should create with existing ID', () => {
      const existingId = 'existing-id';
      const result = BudgetLine.create(validProps, existingId);

      expect(result.isSuccess).toBe(true);
      const budgetLine = result.getValue();
      expect(budgetLine.id).toBe(existingId);
    });
  });

  describe('updateAmount', () => {
    it('should update amount successfully', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();
      const newAmount = createValidAmount(2000);

      const result = budgetLine.updateAmount(newAmount);

      expect(result.isSuccess).toBe(true);
      expect(budgetLine.amount).toBe(newAmount);
      expect(budgetLine.category.isManuallyAdjusted).toBe(true);
      expect(budgetLine.updatedAt).not.toBe(budgetLine.createdAt);
    });

    it('should fail to update fixed expense to zero', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ kind: 'fixed' }),
      }).getValue();
      const zeroAmount = createValidAmount(0);

      const result = budgetLine.updateAmount(zeroAmount);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
      expect(result.error.message).toBe(
        'Fixed expenses cannot have zero amount',
      );
    });

    it('should allow envelope to have zero amount', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ kind: 'envelope' }),
      }).getValue();
      const zeroAmount = createValidAmount(0);

      const result = budgetLine.updateAmount(zeroAmount);

      expect(result.isSuccess).toBe(true);
      expect(budgetLine.amount).toBe(zeroAmount);
    });
  });

  describe('updateCategory', () => {
    it('should update category successfully', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();
      const newCategory = createValidCategory({ name: 'Utilities' });

      const result = budgetLine.updateCategory(newCategory);

      expect(result.isSuccess).toBe(true);
      expect(budgetLine.category).toBe(newCategory);
      expect(budgetLine.updatedAt).not.toBe(budgetLine.createdAt);
    });

    it('should fail to change to fixed with zero amount', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ kind: 'envelope' }),
        amount: createValidAmount(0),
      }).getValue();

      const fixedCategory = createValidCategory({ kind: 'fixed' });
      const result = budgetLine.updateCategory(fixedCategory);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_CATEGORY');
      expect(result.error.message).toBe(
        'Fixed expenses cannot have zero amount',
      );
    });
  });

  describe('savings goal operations', () => {
    it('should link to savings goal', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();

      const result = budgetLine.linkToSavingsGoal('goal-456');

      expect(result.isSuccess).toBe(true);
      expect(budgetLine.savingsGoalId).toBe('goal-456');
      expect(budgetLine.templateLineId).toBe(null);
      expect(budgetLine.isLinkedToSavingsGoal()).toBe(true);
    });

    it('should fail to link with empty savings goal ID', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();

      const result = budgetLine.linkToSavingsGoal('');

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_SAVINGS_GOAL');
    });

    it('should unlink from savings goal', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        savingsGoalId: 'goal-123',
      }).getValue();

      budgetLine.unlinkFromSavingsGoal();

      expect(budgetLine.savingsGoalId).toBe(null);
      expect(budgetLine.isLinkedToSavingsGoal()).toBe(false);
    });

    it('should remove template link when linking to savings goal', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        templateLineId: 'template-123',
      }).getValue();

      budgetLine.linkToSavingsGoal('goal-456');

      expect(budgetLine.templateLineId).toBe(null);
      expect(budgetLine.savingsGoalId).toBe('goal-456');
    });
  });

  describe('getMonthlyEquivalent', () => {
    it('should return same amount for monthly recurrence', () => {
      const monthlyLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ recurrence: 'monthly' }),
        amount: createValidAmount(1000),
      }).getValue();

      const monthly = monthlyLine.getMonthlyEquivalent();

      expect(monthly.value).toBe(1000);
    });

    it('should divide by 12 for yearly recurrence', () => {
      const yearlyLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ recurrence: 'yearly' }),
        amount: createValidAmount(1200),
      }).getValue();

      const monthly = yearlyLine.getMonthlyEquivalent();

      expect(monthly.value).toBe(100);
    });

    it('should divide by 12 for one-time recurrence', () => {
      const oneTimeLine = BudgetLine.create({
        ...validProps,
        category: createValidCategory({ recurrence: 'one-time' }),
        amount: createValidAmount(600),
      }).getValue();

      const monthly = oneTimeLine.getMonthlyEquivalent();

      expect(monthly.value).toBe(50);
    });
  });

  describe('business rules', () => {
    it('should allow deletion by default', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();

      expect(budgetLine.canBeDeleted()).toBe(true);
    });

    it('should identify template-based lines', () => {
      const fromTemplate = BudgetLine.create({
        ...validProps,
        templateLineId: 'template-123',
      }).getValue();

      const notFromTemplate = BudgetLine.create(validProps).getValue();

      expect(fromTemplate.isFromTemplate()).toBe(true);
      expect(notFromTemplate.isFromTemplate()).toBe(false);
    });
  });

  describe('toSnapshot', () => {
    it('should create a complete snapshot', () => {
      const budgetLine = BudgetLine.create({
        ...validProps,
        templateLineId: 'template-123',
      }).getValue();

      const snapshot = budgetLine.toSnapshot();

      expect(snapshot).toEqual({
        id: budgetLine.id,
        budgetId: validProps.budgetId,
        templateLineId: 'template-123',
        savingsGoalId: null,
        name: 'Rent',
        amount: 1500,
        kind: 'fixed',
        recurrence: 'monthly',
        isManuallyAdjusted: false,
        createdAt: budgetLine.createdAt,
        updatedAt: budgetLine.updatedAt,
      });
    });

    it('should handle null values in snapshot', () => {
      const budgetLine = BudgetLine.create(validProps).getValue();
      const snapshot = budgetLine.toSnapshot();

      expect(snapshot.templateLineId).toBe(null);
      expect(snapshot.savingsGoalId).toBe(null);
    });
  });
});
