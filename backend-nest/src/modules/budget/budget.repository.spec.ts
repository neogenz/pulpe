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

    it('should calculate correct aggregates with envelope logic (free transactions)', async () => {
      // All transactions are free (no budget_line_id), so they add on top of budget lines
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'expense', amount: 500 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'income', amount: 3000 },
        { id: 'line-3', budget_id: 'budget-1', kind: 'saving', amount: 200 },
        { id: 'line-4', budget_id: 'budget-2', kind: 'expense', amount: 1000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 100,
          budget_line_id: null,
        },
        {
          budget_id: 'budget-1',
          kind: 'income',
          amount: 500,
          budget_line_id: null,
        },
        {
          budget_id: 'budget-2',
          kind: 'saving',
          amount: 300,
          budget_line_id: null,
        },
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
      // Envelope: max(500,0)=500 + max(200,0)=200 + 100 (free expense) = 800
      expect(budget1?.totalExpenses).toBe(800);
      // Income: 3000 (line) + 500 (free tx) = 3500
      expect(budget1?.totalIncome).toBe(3500);
      // totalSavings: max(200, 0) = 200 (envelope, no allocated saving tx)
      expect(budget1?.totalSavings).toBe(200);

      const budget2 = result.get('budget-2');
      expect(budget2).toBeDefined();
      // Envelope: max(1000,0)=1000 + 300 (free saving tx) = 1300
      expect(budget2?.totalExpenses).toBe(1300);
      expect(budget2?.totalIncome).toBe(0);
      // totalSavings: 300 (free saving tx, no saving budget lines)
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

    it('should not double-count allocated transactions (envelope logic)', async () => {
      // ARRANGE — budget line of 500 with an allocated transaction of 100
      // Envelope logic: max(500, 100) = 500, NOT 500 + 100 = 600
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'expense', amount: 500 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'income', amount: 3000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 100,
          budget_line_id: 'line-1',
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — should be 500 (envelope covers the 100 transaction), NOT 600
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(500);
      expect(budget1?.totalIncome).toBe(3000);
    });

    it('should use max(line, consumed) when allocated transactions exceed envelope', async () => {
      // ARRANGE — budget line of 100, allocated transactions totaling 250
      // Envelope logic: max(100, 250) = 250
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'expense', amount: 100 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'income', amount: 5000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 150,
          budget_line_id: 'line-1',
        },
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 100,
          budget_line_id: 'line-1',
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — max(100, 150+100) = max(100, 250) = 250
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(250);
      expect(budget1?.totalIncome).toBe(5000);
    });

    it('should count free transactions (no budget_line_id) separately', async () => {
      // ARRANGE — budget line of 500, plus a free transaction of 75
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'expense', amount: 500 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'income', amount: 3000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 100,
          budget_line_id: 'line-1',
        },
        {
          budget_id: 'budget-1',
          kind: 'expense',
          amount: 75,
          budget_line_id: null,
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — max(500, 100) + 75 (free) = 500 + 75 = 575
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(575);
      expect(budget1?.totalIncome).toBe(3000);
    });

    it('should handle savings with envelope logic (savings treated as expenses)', async () => {
      // ARRANGE — saving line of 300, allocated saving transaction of 200
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'saving', amount: 300 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'income', amount: 5000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'saving',
          amount: 200,
          budget_line_id: 'line-1',
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — max(300, 200) = 300
      // totalExpenses includes savings per SPECS
      const budget1 = result.get('budget-1');
      expect(budget1?.totalExpenses).toBe(300);
      expect(budget1?.totalIncome).toBe(5000);
    });

    it('should handle income with envelope logic (income lines + free income transactions)', async () => {
      // ARRANGE — income line of 5000, plus a free income transaction of 300
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'income', amount: 5000 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'expense', amount: 1000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'income',
          amount: 300,
          budget_line_id: null,
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — income: 5000 (budget line) + 300 (free transaction) = 5300
      const budget1 = result.get('budget-1');
      expect(budget1?.totalIncome).toBe(5300);
      expect(budget1?.totalExpenses).toBe(1000);
    });

    it('should not double-count allocated income transactions', async () => {
      // ARRANGE
      const mockBudgetLines = [
        { id: 'line-1', budget_id: 'budget-1', kind: 'income', amount: 5000 },
        { id: 'line-2', budget_id: 'budget-1', kind: 'expense', amount: 1000 },
      ];

      const mockTransactions = [
        {
          budget_id: 'budget-1',
          kind: 'income',
          amount: 4800,
          budget_line_id: 'line-1',
        },
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

      // ACT
      const result = await repository.fetchBudgetAggregates(
        ['budget-1'],
        mockSupabase as any,
        (amount) => Number(amount) || 0,
      );

      // ASSERT — income uses envelope: max(5000, 4800) = 5000, NOT 5000 + 4800 = 9800
      const budget1 = result.get('budget-1');
      expect(budget1?.totalIncome).toBe(5000);
      expect(budget1?.totalExpenses).toBe(1000);
    });
  });
});
