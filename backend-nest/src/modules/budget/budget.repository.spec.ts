import { describe, it, expect, beforeEach } from 'bun:test';
import { BudgetRepository } from './budget.repository';

describe('BudgetRepository', () => {
  let repository: BudgetRepository;

  beforeEach(() => {
    repository = new BudgetRepository();
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
});
