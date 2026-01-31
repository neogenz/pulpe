import { describe, it, expect } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';
import {
  addBudgetLine,
  addTransaction,
  applyToggleResult,
  patchBudgetLine,
  removeBudgetLine,
  removeTransaction,
  replaceBudgetLine,
  replaceTransaction,
} from './budget-details-updaters';

const createBudgetLine = (overrides: Partial<BudgetLine> = {}): BudgetLine => ({
  id: 'line-1',
  budgetId: 'budget-1',
  name: 'Test Line',
  amount: 100,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  templateLineId: null,
  savingsGoalId: null,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'tx-1',
  budgetId: 'budget-1',
  budgetLineId: 'line-1',
  name: 'Test Transaction',
  amount: 50,
  kind: 'expense',
  transactionDate: '2024-01-15T00:00:00.000Z',
  category: null,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createViewModel = (
  overrides: Partial<BudgetDetailsViewModel> = {},
): BudgetDetailsViewModel =>
  ({
    id: 'budget-1',
    month: 1,
    year: 2024,
    description: 'January 2024',
    templateId: 'template-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    budgetLines: [],
    transactions: [],
    ...overrides,
  }) as BudgetDetailsViewModel;

describe('Budget Details Updaters', () => {
  describe('addBudgetLine', () => {
    it('should append a budget line to the list', () => {
      const vm = createViewModel({
        budgetLines: [createBudgetLine({ id: 'existing' })],
      });
      const newLine = createBudgetLine({ id: 'new-line' });

      const result = addBudgetLine(vm, newLine);

      expect(result.budgetLines).toHaveLength(2);
      expect(result.budgetLines[1].id).toBe('new-line');
    });

    it('should not mutate the original view model', () => {
      const vm = createViewModel();
      addBudgetLine(vm, createBudgetLine());

      expect(vm.budgetLines).toHaveLength(0);
    });
  });

  describe('replaceBudgetLine', () => {
    it('should replace the line matching oldId', () => {
      const vm = createViewModel({
        budgetLines: [
          createBudgetLine({ id: 'line-1', name: 'Old' }),
          createBudgetLine({ id: 'line-2', name: 'Other' }),
        ],
      });
      const replacement = createBudgetLine({ id: 'line-1-real', name: 'New' });

      const result = replaceBudgetLine(vm, 'line-1', replacement);

      expect(result.budgetLines[0].id).toBe('line-1-real');
      expect(result.budgetLines[0].name).toBe('New');
      expect(result.budgetLines[1].id).toBe('line-2');
    });
  });

  describe('patchBudgetLine', () => {
    it('should patch the line matching data.id with new properties', () => {
      const vm = createViewModel({
        budgetLines: [
          createBudgetLine({ id: 'line-1', name: 'Old', amount: 100 }),
          createBudgetLine({ id: 'line-2', name: 'Other' }),
        ],
      });

      const result = patchBudgetLine(vm, {
        id: 'line-1',
        name: 'Updated',
        amount: 200,
      });

      expect(result.budgetLines[0].name).toBe('Updated');
      expect(result.budgetLines[0].amount).toBe(200);
      expect(result.budgetLines[0].updatedAt).not.toBe(
        '2024-01-01T00:00:00.000Z',
      );
      expect(result.budgetLines[1].name).toBe('Other');
    });

    it('should set updatedAt to current timestamp', () => {
      const vm = createViewModel({
        budgetLines: [createBudgetLine({ id: 'line-1' })],
      });

      const result = patchBudgetLine(vm, { id: 'line-1', name: 'Patched' });

      expect(
        new Date(result.budgetLines[0].updatedAt).getTime(),
      ).toBeGreaterThan(0);
    });
  });

  describe('removeBudgetLine', () => {
    it('should remove the line with matching id', () => {
      const vm = createViewModel({
        budgetLines: [
          createBudgetLine({ id: 'line-1' }),
          createBudgetLine({ id: 'line-2' }),
        ],
      });

      const result = removeBudgetLine(vm, 'line-1');

      expect(result.budgetLines).toHaveLength(1);
      expect(result.budgetLines[0].id).toBe('line-2');
    });
  });

  describe('addTransaction', () => {
    it('should append a transaction to the list', () => {
      const vm = createViewModel({
        transactions: [createTransaction({ id: 'existing' })],
      });
      const newTx = createTransaction({ id: 'new-tx' });

      const result = addTransaction(vm, newTx);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[1].id).toBe('new-tx');
    });
  });

  describe('replaceTransaction', () => {
    it('should replace the transaction matching oldId', () => {
      const vm = createViewModel({
        transactions: [
          createTransaction({ id: 'tx-1', name: 'Old' }),
          createTransaction({ id: 'tx-2', name: 'Other' }),
        ],
      });
      const replacement = createTransaction({
        id: 'tx-1-real',
        name: 'New',
      });

      const result = replaceTransaction(vm, 'tx-1', replacement);

      expect(result.transactions[0].id).toBe('tx-1-real');
      expect(result.transactions[0].name).toBe('New');
      expect(result.transactions[1].id).toBe('tx-2');
    });
  });

  describe('removeTransaction', () => {
    it('should remove the transaction with matching id', () => {
      const vm = createViewModel({
        transactions: [
          createTransaction({ id: 'tx-1' }),
          createTransaction({ id: 'tx-2' }),
        ],
      });

      const result = removeTransaction(vm, 'tx-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe('tx-2');
    });
  });

  describe('applyToggleResult', () => {
    it('should replace both budgetLines and transactions from toggle result', () => {
      const vm = createViewModel({
        budgetLines: [createBudgetLine({ id: 'line-1', checkedAt: null })],
        transactions: [createTransaction({ id: 'tx-1', checkedAt: null })],
      });

      const updatedBudgetLines = [
        createBudgetLine({
          id: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];
      const updatedTransactions = [
        createTransaction({
          id: 'tx-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];

      const result = applyToggleResult(vm, {
        updatedBudgetLines,
        updatedTransactions,
      });

      expect(result.budgetLines[0].checkedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.transactions[0].checkedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should preserve other view model properties', () => {
      const vm = createViewModel({ description: 'Keep this' });

      const result = applyToggleResult(vm, {
        updatedBudgetLines: [],
        updatedTransactions: [],
      });

      expect(result.description).toBe('Keep this');
      expect(result.id).toBe('budget-1');
    });
  });
});
