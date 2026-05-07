import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { SupabaseBudgetLineRepository } from './supabase-budget-line.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineRow } from '../../domain/budget-line.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

const mockRow: BudgetLineRow = {
  id: 'line-1',
  budget_id: 'budget-1',
  template_line_id: null,
  savings_goal_id: null,
  name: 'Loyer',
  amount: 'encrypted',
  kind: 'expense' as const,
  recurrence: 'fixed' as const,
  is_manually_adjusted: false,
  checked_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

function createMockSupabase(
  fromFn: (table: string) => unknown,
  rpcFn?: jest.Mock,
): AuthenticatedSupabaseClient {
  return {
    from: fromFn,
    rpc: rpcFn ?? jest.fn(),
  } as unknown as AuthenticatedSupabaseClient;
}

describe('SupabaseBudgetLineRepository', () => {
  let repo: SupabaseBudgetLineRepository;

  beforeEach(() => {
    repo = new SupabaseBudgetLineRepository();
  });

  describe('findById', () => {
    it('should return a budget line row on success', async () => {
      const supabase = createMockSupabase(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));

      const result = await repo.findById('line-1', supabase);

      expect(result).toEqual(mockRow);
    });

    it('should throw BusinessException when not found', async () => {
      const supabase = createMockSupabase(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }));

      await expect(repo.findById('missing', supabase)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('insert', () => {
    it('should return inserted row on success', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));

      const result = await repo.insert(
        {
          budget_id: 'budget-1',
          name: 'Loyer',
          amount: 'enc',
          kind: 'expense',
          recurrence: 'fixed',
          is_manually_adjusted: false,
        },
        supabase,
      );

      expect(result).toEqual(mockRow);
    });

    it('should throw BUDGET_LINE_ALREADY_EXISTS on 23505', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate' },
            }),
          }),
        }),
      }));

      await expect(
        repo.insert(
          {
            budget_id: 'budget-1',
            name: 'Loyer',
            amount: 'enc',
            kind: 'expense',
            recurrence: 'fixed',
            is_manually_adjusted: false,
          },
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should resolve on success', async () => {
      const supabase = createMockSupabase(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));

      await expect(repo.delete('line-1', supabase)).resolves.toBeUndefined();
    });

    it('should throw when deletion fails', async () => {
      const supabase = createMockSupabase(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Delete failed' },
          }),
        }),
      }));

      await expect(repo.delete('line-1', supabase)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('toggleCheckRpc', () => {
    it('should return updated row from rpc', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      const supabase = createMockSupabase(() => ({}), mockRpc);

      const result = await repo.toggleCheckRpc('line-1', supabase);

      expect(result).toEqual(mockRow);
      expect(mockRpc).toHaveBeenCalledWith('toggle_budget_line_check', {
        p_budget_line_id: 'line-1',
      });
    });

    it('should throw when rpc fails', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'RPC error' },
        }),
      });
      const supabase = createMockSupabase(() => ({}), mockRpc);

      await expect(repo.toggleCheckRpc('line-1', supabase)).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
