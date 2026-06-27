import { describe, it, expect, beforeEach } from 'bun:test';
import { BudgetMapper } from './budget.mapper';
import type {
  Budget,
  BudgetLineDecrypted,
  BudgetWithDetails,
} from '../../domain/budget.entity';

const baseLine: BudgetLineDecrypted = {
  id: 'line-1',
  budgetId: 'budget-1',
  templateLineId: null,
  savingsGoalId: null,
  spreadGroupId: null,
  name: 'Prime assurance',
  amount: 100,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'one_off',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseBudget: Budget = {
  id: 'budget-1',
  userId: 'user-1',
  templateId: 'template-1',
  month: 1,
  year: 2026,
  description: 'Janvier',
  endingBalance: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('BudgetMapper spreadGroupId', () => {
  let mapper: BudgetMapper;

  beforeEach(() => {
    mapper = new BudgetMapper();
  });

  describe('toBudgetLineApi', () => {
    it('carries a non-null spreadGroupId through to the API DTO', () => {
      const entity: BudgetLineDecrypted = {
        ...baseLine,
        spreadGroupId: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      };

      const dto = mapper.toBudgetLineApi(entity);

      expect(dto.spreadGroupId).toBe('a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d');
    });

    it('keeps spreadGroupId null for a non-spread line', () => {
      const dto = mapper.toBudgetLineApi({ ...baseLine, spreadGroupId: null });

      expect(dto.spreadGroupId).toBeNull();
    });
  });

  describe('toBudgetDetailsResponse', () => {
    it('carries spreadGroupId through the details-response budget lines', () => {
      const composite: BudgetWithDetails = {
        budget: baseBudget,
        budgetLines: [
          {
            ...baseLine,
            id: 'spread-line',
            spreadGroupId: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
          },
          { ...baseLine, id: 'plain-line', spreadGroupId: null },
        ],
        transactions: [],
        rollover: 0,
        previousBudgetId: null,
      };

      const response = mapper.toBudgetDetailsResponse(composite);

      const spreadLine = response.data.budgetLines.find(
        (line) => line.id === 'spread-line',
      );
      const plainLine = response.data.budgetLines.find(
        (line) => line.id === 'plain-line',
      );
      expect(spreadLine?.spreadGroupId).toBe(
        'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      );
      expect(plainLine?.spreadGroupId).toBeNull();
    });
  });
});
