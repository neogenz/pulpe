import { describe, it, expect, beforeEach } from 'bun:test';
import { BudgetRepository } from './budget.repository';
import { createMockPinoLogger } from '../../test/test-mocks';
import type { InfoLogger } from '@common/logger';

describe('BudgetRepository', () => {
  let repository: BudgetRepository;
  let mockLogger: InfoLogger;

  beforeEach(() => {
    mockLogger = createMockPinoLogger() as unknown as InfoLogger;
    repository = new BudgetRepository(mockLogger);
  });

  describe('fetchBudgetData', () => {
    it('should use separate field selections for budget_line and transaction tables', async () => {
      // ARRANGE
      const capturedCalls: { table: string; fields: string }[] = [];

      const createQueryChain = (table: string, fields: string) => {
        capturedCalls.push({ table, fields });
        return {
          eq: () => ({
            order: () => ({
              then: (cb: (result: { data: unknown[]; error: null }) => void) =>
                cb({ data: [], error: null }),
            }),
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
        };
      };

      const mockSupabase = {
        from: (table: string) => ({
          select: (fields: string) => createQueryChain(table, fields),
        }),
      };

      // ACT
      await repository.fetchBudgetData('budget-id', mockSupabase as any, {
        budgetLineFields: 'id, kind, amount',
        transactionFields: 'id, kind, amount, budget_line_id',
      });

      // ASSERT
      const budgetLineCall = capturedCalls.find(
        (c) => c.table === 'budget_line',
      );
      const transactionCall = capturedCalls.find(
        (c) => c.table === 'transaction',
      );

      expect(budgetLineCall).toBeDefined();
      expect(transactionCall).toBeDefined();
      expect(budgetLineCall?.fields).toBe('id, kind, amount');
      expect(transactionCall?.fields).toBe('id, kind, amount, budget_line_id');

      // CRITICAL: Verify budget_line_id is NOT passed to budget_line table
      expect(budgetLineCall?.fields).not.toContain('budget_line_id');
    });

    it('should use default fields when no options provided', async () => {
      // ARRANGE
      const capturedCalls: { table: string; fields: string }[] = [];

      const createQueryChain = (table: string, fields: string) => {
        capturedCalls.push({ table, fields });
        return {
          eq: () => ({
            order: () => ({
              then: (cb: (result: { data: unknown[]; error: null }) => void) =>
                cb({ data: [], error: null }),
            }),
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
        };
      };

      const mockSupabase = {
        from: (table: string) => ({
          select: (fields: string) => createQueryChain(table, fields),
        }),
      };

      // ACT
      await repository.fetchBudgetData('budget-id', mockSupabase as any);

      // ASSERT
      const budgetLineCall = capturedCalls.find(
        (c) => c.table === 'budget_line',
      );
      const transactionCall = capturedCalls.find(
        (c) => c.table === 'transaction',
      );

      expect(budgetLineCall?.fields).toBe('kind, amount');
      expect(transactionCall?.fields).toBe('kind, amount');
    });

    it('should return empty arrays when database returns no data', async () => {
      // ARRANGE
      const createQueryChain = () => ({
        eq: () => ({
          order: () => ({
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
        }),
        then: (cb: (result: { data: unknown[]; error: null }) => void) =>
          cb({ data: [], error: null }),
      });

      const mockSupabase = {
        from: () => ({
          select: () => createQueryChain(),
        }),
      };

      // ACT
      const result = await repository.fetchBudgetData(
        'budget-id',
        mockSupabase as any,
      );

      // ASSERT
      expect(result.budgetLines).toEqual([]);
      expect(result.transactions).toEqual([]);
      expect(result.budget).toBeUndefined();
    });

    it('should include budget data when includeBudget option is true', async () => {
      // ARRANGE
      const mockBudget = {
        id: 'budget-id',
        month: 1,
        year: 2024,
        user_id: 'user-id',
      };

      const createQueryChain = (table: string) => {
        if (table === 'monthly_budget') {
          return {
            eq: () => ({
              single: () => ({
                then: (
                  cb: (result: {
                    data: typeof mockBudget;
                    error: null;
                  }) => void,
                ) =>
                  cb({
                    data: mockBudget,
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {
          eq: () => ({
            order: () => ({
              then: (cb: (result: { data: unknown[]; error: null }) => void) =>
                cb({ data: [], error: null }),
            }),
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
        };
      };

      const mockSupabase = {
        from: (table: string) => ({
          select: () => createQueryChain(table),
        }),
      };

      // ACT
      const result = await repository.fetchBudgetData(
        'budget-id',
        mockSupabase as any,
        { includeBudget: true },
      );

      // ASSERT
      expect(result.budget).toBeDefined();
      expect(result.budget?.id).toBe('budget-id');
    });

    it('should order transactions when orderTransactions option is true', async () => {
      // ARRANGE
      let orderCalled = false;
      let orderParams: {
        column: string;
        options: { ascending: boolean };
      } | null = null;

      const createQueryChain = (table: string) => {
        return {
          eq: () => ({
            order: (column: string, options: { ascending: boolean }) => {
              if (table === 'transaction') {
                orderCalled = true;
                orderParams = { column, options };
              }
              return {
                then: (
                  cb: (result: { data: unknown[]; error: null }) => void,
                ) => cb({ data: [], error: null }),
              };
            },
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
        };
      };

      const mockSupabase = {
        from: (table: string) => ({
          select: () => createQueryChain(table),
        }),
      };

      // ACT
      await repository.fetchBudgetData('budget-id', mockSupabase as any, {
        orderTransactions: true,
      });

      // ASSERT
      expect(orderCalled).toBe(true);
      expect(orderParams).not.toBeNull();
      expect(orderParams!.column).toBe('transaction_date');
      expect(orderParams!.options.ascending).toBe(false);
    });
  });

  describe('fetchBudgetAggregates', () => {
    it('should return empty map when no budget IDs provided', async () => {
      const mockSupabase = {} as any;
      const result = await repository.fetchBudgetAggregates([], mockSupabase);
      expect(result.size).toBe(0);
    });

    it('should calculate correct aggregates from budget_lines and transactions', async () => {
      const mockBudgetLines = [
        { budget_id: 'budget-1', kind: 'expense', amount: 500 },
        { budget_id: 'budget-1', kind: 'income', amount: 3000 },
        { budget_id: 'budget-1', kind: 'saving', amount: 200 },
        { budget_id: 'budget-2', kind: 'expense', amount: 1000 },
      ];

      const mockTransactions = [
        { budget_id: 'budget-1', kind: 'expense', amount: 100 },
        { budget_id: 'budget-1', kind: 'income', amount: 500 },
        { budget_id: 'budget-2', kind: 'saving', amount: 300 },
      ];

      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            in: () => {
              if (table === 'budget_line') {
                return Promise.resolve({ data: mockBudgetLines, error: null });
              }
              return Promise.resolve({ data: mockTransactions, error: null });
            },
          }),
        }),
      };

      const result = await repository.fetchBudgetAggregates(
        ['budget-1', 'budget-2'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      expect(result.size).toBe(2);

      const budget1 = result.get('budget-1');
      expect(budget1).toBeDefined();
      expect(budget1?.totalExpenses).toBe(600); // 500 + 100
      expect(budget1?.totalIncome).toBe(3500); // 3000 + 500
      expect(budget1?.totalSavings).toBe(200);

      const budget2 = result.get('budget-2');
      expect(budget2).toBeDefined();
      expect(budget2?.totalExpenses).toBe(1000);
      expect(budget2?.totalIncome).toBe(0);
      expect(budget2?.totalSavings).toBe(300);
    });

    it('should return zero aggregates when no budget_lines or transactions exist', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };

      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
      );

      expect(result.size).toBe(1);
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(0);
      expect(budget1?.totalIncome).toBe(0);
      expect(budget1?.totalSavings).toBe(0);
    });

    it('should handle null data gracefully', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            in: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };

      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
      );

      expect(result.size).toBe(1);
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(0);
      expect(budget1?.totalIncome).toBe(0);
      expect(budget1?.totalSavings).toBe(0);
    });

    it('should return zero aggregates when fetch throws an error', async () => {
      // ARRANGE
      const mockSupabase = {
        from: () => ({
          select: () => ({
            in: () => Promise.reject(new Error('Network error')),
          }),
        }),
      };

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1', 'budget-2'],
        mockSupabase as any,
      );

      // ASSERT — method should not throw, returns zeros
      expect(result.size).toBe(2);

      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(0);
      expect(budget1?.totalIncome).toBe(0);
      expect(budget1?.totalSavings).toBe(0);

      const budget2 = result.get('budget-2');
      expect(budget2?.totalExpenses).toBe(0);
      expect(budget2?.totalIncome).toBe(0);
      expect(budget2?.totalSavings).toBe(0);
    });
  });
});
