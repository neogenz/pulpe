import { describe, it, expect } from 'bun:test';
import { toApi, toUpdate } from './budget-line.mappers';
import type { BudgetLineRow } from './entities/budget-line.entity';
import type { BudgetLineUpdate } from 'pulpe-shared';

describe('BudgetLine Mappers', () => {
  describe('toApi', () => {
    it('should transform database row to API entity correctly', () => {
      const dbRow: BudgetLineRow = {
        id: 'test-id',
        budget_id: 'budget-123',
        template_line_id: 'template-456',
        savings_goal_id: null,
        name: 'Test Budget Line',
        amount: 1500,
        amount_encrypted: null,
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: true,
        checked_at: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      const result = toApi(dbRow);

      expect(result).toEqual({
        id: 'test-id',
        budgetId: 'budget-123',
        templateLineId: 'template-456',
        savingsGoalId: null,
        name: 'Test Budget Line',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: true,
        checkedAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
    });

    it('should handle false isManuallyAdjusted correctly', () => {
      const dbRow: BudgetLineRow = {
        id: 'test-id',
        budget_id: 'budget-123',
        template_line_id: null,
        savings_goal_id: null,
        name: 'Test',
        amount: 100,
        amount_encrypted: null,
        kind: 'income',
        recurrence: 'one_off',
        is_manually_adjusted: false,
        checked_at: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = toApi(dbRow);

      expect(result.isManuallyAdjusted).toBe(false);
    });
  });

  describe('toUpdate', () => {
    it('should include is_manually_adjusted when isManuallyAdjusted is true', () => {
      const updateDto: BudgetLineUpdate = {
        id: 'test-id',
        name: 'Updated Name',
        amount: 2000,
        isManuallyAdjusted: true,
      };

      const result = toUpdate(updateDto);

      expect(result).toHaveProperty('is_manually_adjusted', true);
      expect(result).toHaveProperty('name', 'Updated Name');
      expect(result).toHaveProperty('amount', 2000);
    });

    it('should include is_manually_adjusted when isManuallyAdjusted is false', () => {
      const updateDto: BudgetLineUpdate = {
        id: 'test-id',
        isManuallyAdjusted: false,
      };

      const result = toUpdate(updateDto);

      expect(result).toHaveProperty('is_manually_adjusted', false);
    });

    it('should not include is_manually_adjusted when isManuallyAdjusted is undefined', () => {
      const updateDto: BudgetLineUpdate = {
        id: 'test-id',
        name: 'Only Name Update',
      };

      const result = toUpdate(updateDto);

      expect(result).not.toHaveProperty('is_manually_adjusted');
      expect(result).toHaveProperty('name', 'Only Name Update');
    });

    it('should handle all fields correctly', () => {
      const updateDto: BudgetLineUpdate = {
        id: 'test-id',
        name: 'Full Update',
        amount: 3000,
        kind: 'saving',
        recurrence: 'one_off',
        templateLineId: 'template-789',
        savingsGoalId: 'savings-123',
        isManuallyAdjusted: true,
      };

      const result = toUpdate(updateDto);

      expect(result).toEqual({
        name: 'Full Update',
        amount: 3000,
        kind: 'saving',
        recurrence: 'one_off',
        template_line_id: 'template-789',
        savings_goal_id: 'savings-123',
        is_manually_adjusted: true,
      });
    });

    it('should return empty object when only id is provided', () => {
      const updateDto: BudgetLineUpdate = {
        id: 'test-id',
      };

      const result = toUpdate(updateDto);

      expect(result).toEqual({});
    });
  });
});
