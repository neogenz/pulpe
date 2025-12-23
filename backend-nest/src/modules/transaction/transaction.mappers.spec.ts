import { describe, it, expect } from 'bun:test';
import { toApi, toApiList, toInsert, toUpdate } from './transaction.mappers';
import type { TransactionRow } from './entities/transaction.entity';
import type { TransactionCreate, TransactionUpdate } from '@pulpe/shared';

// Valid UUIDs for testing (Zod validates UUID format - requires version 4 pattern)
const TEST_UUIDS = {
  TX_1: '11111111-1111-4111-8111-111111111111',
  TX_2: '22222222-2222-4222-8222-222222222222',
  BUDGET: '33333333-3333-4333-8333-333333333333',
  LINE_1: '44444444-4444-4444-8444-444444444444',
  LINE_2: '55555555-5555-4555-8555-555555555555',
};

describe('Transaction Mappers - budgetLineId', () => {
  describe('toApi', () => {
    it('should map budget_line_id to budgetLineId', () => {
      const dbRow: TransactionRow = {
        id: TEST_UUIDS.TX_1,
        budget_id: TEST_UUIDS.BUDGET,
        budget_line_id: TEST_UUIDS.LINE_1,
        name: 'Test Transaction',
        amount: 100,
        kind: 'expense',
        transaction_date: '2024-01-15T10:00:00Z',
        category: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = toApi(dbRow);

      expect(result.budgetLineId).toBe(TEST_UUIDS.LINE_1);
    });

    it('should map budget_line_id null correctly', () => {
      const dbRow: TransactionRow = {
        id: TEST_UUIDS.TX_1,
        budget_id: TEST_UUIDS.BUDGET,
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
          id: TEST_UUIDS.TX_1,
          budget_id: TEST_UUIDS.BUDGET,
          budget_line_id: TEST_UUIDS.LINE_1,
          name: 'Allocated',
          amount: 100,
          kind: 'expense',
          transaction_date: '2024-01-15T10:00:00Z',
          category: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: TEST_UUIDS.TX_2,
          budget_id: TEST_UUIDS.BUDGET,
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

      expect(result[0].budgetLineId).toBe(TEST_UUIDS.LINE_1);
      expect(result[1].budgetLineId).toBeNull();
    });
  });

  describe('toInsert', () => {
    it('should map budgetLineId to budget_line_id', () => {
      const createDto: TransactionCreate = {
        budgetId: TEST_UUIDS.BUDGET,
        budgetLineId: TEST_UUIDS.LINE_1,
        name: 'Allocated Transaction',
        amount: 100,
        kind: 'expense',
        transactionDate: '2024-01-15T10:00:00Z',
      };

      const result = toInsert(createDto);

      expect(result.budget_line_id).toBe(TEST_UUIDS.LINE_1);
    });

    it('should handle budgetLineId null', () => {
      const createDto: TransactionCreate = {
        budgetId: TEST_UUIDS.BUDGET,
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
        budgetId: TEST_UUIDS.BUDGET,
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
        budgetLineId: TEST_UUIDS.LINE_2,
      };

      const result = toUpdate(updateDto);

      expect(result.budget_line_id).toBe(TEST_UUIDS.LINE_2);
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
