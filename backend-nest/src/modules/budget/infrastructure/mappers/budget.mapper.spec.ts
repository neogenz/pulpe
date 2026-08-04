import { describe, it, expect, beforeEach } from 'bun:test';
import { BudgetMapper } from './budget.mapper';
import type {
  Budget,
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '../../domain/budget.entity';

const baseLine: BudgetLineDecrypted = {
  id: 'line-1',
  budgetId: 'budget-1',
  templateLineId: null,
  savingsGoalId: null,
  spreadGroupId: null,
  savingsWithdrawalGroupId: null,
  name: 'Prime assurance',
  amount: 100,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'one_off',
  tagIds: [],
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseTransaction: TransactionDecrypted = {
  id: 'tx-1',
  budgetId: 'budget-1',
  budgetLineId: null,
  name: 'Salaire',
  amount: 3000,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'income',
  transactionDate: '2026-01-05',
  tagIds: [],
  checkedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  sourceSavingsGoalId: null,
  sourceSavingsGoalName: null,
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
        savingsWithdrawalGroupId: null,
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
            savingsWithdrawalGroupId: null,
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

describe('BudgetMapper sourceSavingsGoal (PUL-329)', () => {
  let mapper: BudgetMapper;

  beforeEach(() => {
    mapper = new BudgetMapper();
  });

  describe('toTransactionApi', () => {
    it('carries sourceSavingsGoalId and sourceSavingsGoalName through to the API DTO', () => {
      const entity: TransactionDecrypted = {
        ...baseTransaction,
        sourceSavingsGoalId: 'goal-1',
        sourceSavingsGoalName: 'Vacances',
      };

      const dto = mapper.toTransactionApi(entity);

      expect(dto.sourceSavingsGoalId).toBe('goal-1');
      expect(dto.sourceSavingsGoalName).toBe('Vacances');
    });

    it('keeps the origin null for a transaction with no savings-goal source', () => {
      const dto = mapper.toTransactionApi(baseTransaction);

      expect(dto.sourceSavingsGoalId).toBeNull();
      expect(dto.sourceSavingsGoalName).toBeNull();
    });
  });

  describe('toBudgetDetailsResponse', () => {
    it('carries the savings-goal origin through the details-response transactions', () => {
      const composite: BudgetWithDetails = {
        budget: baseBudget,
        budgetLines: [],
        transactions: [
          {
            ...baseTransaction,
            id: 'origin-tx',
            sourceSavingsGoalId: 'goal-1',
            sourceSavingsGoalName: 'Vacances',
          },
          { ...baseTransaction, id: 'plain-tx' },
        ],
        rollover: 0,
        previousBudgetId: null,
      };

      const response = mapper.toBudgetDetailsResponse(composite);

      const originTx = response.data.transactions.find(
        (tx) => tx.id === 'origin-tx',
      );
      const plainTx = response.data.transactions.find(
        (tx) => tx.id === 'plain-tx',
      );
      expect(originTx?.sourceSavingsGoalId).toBe('goal-1');
      expect(originTx?.sourceSavingsGoalName).toBe('Vacances');
      expect(plainTx?.sourceSavingsGoalId).toBeNull();
      expect(plainTx?.sourceSavingsGoalName).toBeNull();
    });
  });
});
