import { describe, it, expect } from 'bun:test';
import { toApi, toApiList, toInsert, toUpdate } from './transaction.mappers';
import type { TransactionRow } from './entities/transaction.entity';
import type { TransactionCreate, TransactionUpdate } from '@pulpe/shared';

describe('Transaction Mappers - budgetLineId', () => {
  describe('toApi', () => {
    it('should map budget_line_id to budgetLineId', () => {
      const dbRow: TransactionRow = {
        id: 'tx-123',
        budget_id: 'budget-456',
        budget_line_id: 'line-789',
        name: 'Test Transaction',
        amount: 100,
        kind: 'expense',
        transaction_date: '2024-01-15T10:00:00Z',
        category: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = toApi(dbRow);

      expect(result.budgetLineId).toBe('line-789');
    });

    it('should map budget_line_id null correctly', () => {
      const dbRow: TransactionRow = {
        id: 'tx-123',
        budget_id: 'budget-456',
        budget_line_id: null,
        name: 'Free Transaction',
        amount: 50,
        kind: 'expense',
        transaction_date: '2024-01-15T10:00:00Z',
        category: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = toApi(dbRow);

      expect(result.budgetLineId).toBeNull();
    });
  });

  describe('toApiList', () => {
    it('should map budget_line_id for all transactions', () => {
      const dbRows: TransactionRow[] = [
        {
          id: 'tx-1',
          budget_id: 'budget-1',
          budget_line_id: 'line-1',
          name: 'Allocated',
          amount: 100,
          kind: 'expense',
          transaction_date: '2024-01-15T10:00:00Z',
          category: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'tx-2',
          budget_id: 'budget-1',
          budget_line_id: null,
          name: 'Free',
          amount: 50,
          kind: 'expense',
          transaction_date: '2024-01-15T10:00:00Z',
          category: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const result = toApiList(dbRows);

      expect(result[0].budgetLineId).toBe('line-1');
      expect(result[1].budgetLineId).toBeNull();
    });
  });

  describe('toInsert', () => {
    it('should map budgetLineId to budget_line_id', () => {
      const createDto: TransactionCreate = {
        budgetId: 'budget-456',
        budgetLineId: 'line-789',
        name: 'Allocated Transaction',
        amount: 100,
        kind: 'expense',
        transactionDate: '2024-01-15T10:00:00Z',
      };

      const result = toInsert(createDto);

      expect(result.budget_line_id).toBe('line-789');
    });

    it('should handle budgetLineId null', () => {
      const createDto: TransactionCreate = {
        budgetId: 'budget-456',
        budgetLineId: null,
        name: 'Free Transaction',
        amount: 100,
        kind: 'expense',
        transactionDate: '2024-01-15T10:00:00Z',
      };

      const result = toInsert(createDto);

      expect(result.budget_line_id).toBeNull();
    });

    it('should default budgetLineId to null when not provided', () => {
      const createDto: TransactionCreate = {
        budgetId: 'budget-456',
        name: 'Transaction without budgetLineId',
        amount: 100,
        kind: 'expense',
        transactionDate: '2024-01-15T10:00:00Z',
      };

      const result = toInsert(createDto);

      expect(result.budget_line_id).toBeNull();
    });
  });

  describe('toUpdate', () => {
    it('should map budgetLineId when provided', () => {
      const updateDto: TransactionUpdate = {
        budgetLineId: 'line-new',
      };

      const result = toUpdate(updateDto);

      expect(result.budget_line_id).toBe('line-new');
    });

    it('should handle budgetLineId null (unallocate)', () => {
      const updateDto: TransactionUpdate = {
        budgetLineId: null,
      };

      const result = toUpdate(updateDto);

      expect(result.budget_line_id).toBeNull();
    });

    it('should not include budget_line_id when budgetLineId not provided', () => {
      const updateDto: TransactionUpdate = {
        name: 'Updated Name',
      };

      const result = toUpdate(updateDto);

      expect('budget_line_id' in result).toBe(false);
    });
  });
});
