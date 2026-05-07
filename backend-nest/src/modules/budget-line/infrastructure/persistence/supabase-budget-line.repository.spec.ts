import { describe, it, expect, jest } from 'bun:test';
import { SupabaseBudgetLineRepository } from './supabase-budget-line.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineRow } from '../../domain/budget-line.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';

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

function createMockProvider(
  fromFn: (table: string) => unknown,
  rpcFn?: jest.Mock,
): AuthenticatedSupabaseProvider {
  const client = {
    from: fromFn,
    rpc: rpcFn ?? jest.fn(),
  } as unknown as AuthenticatedSupabaseClient;

  return {
    get client() {
      return client;
    },
    get user() {
      throw new Error('user not needed in these tests');
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

describe('SupabaseBudgetLineRepository', () => {
  let repo: SupabaseBudgetLineRepository;

  describe('findById', () => {
    it('should return a budget line row on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      const result = await repo.findById('line-1');

      expect(result).toEqual(mockRow);
    });

    it('should throw BusinessException when not found', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('insert', () => {
    it('should return inserted row on success', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      const result = await repo.insert({
        budget_id: 'budget-1',
        name: 'Loyer',
        amount: 'enc',
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });

      expect(result).toEqual(mockRow);
    });

    it('should throw BUDGET_LINE_ALREADY_EXISTS on 23505', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate' },
            }),
          }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      await expect(
        repo.insert({
          budget_id: 'budget-1',
          name: 'Loyer',
          amount: 'enc',
          kind: 'expense',
          recurrence: 'fixed',
          is_manually_adjusted: false,
        }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should resolve on success', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      await expect(repo.delete('line-1')).resolves.toBeUndefined();
    });

    it('should throw when deletion fails', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Delete failed' },
          }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider);

      await expect(repo.delete('line-1')).rejects.toThrow(BusinessException);
    });
  });

  describe('toggleCheckRpc', () => {
    it('should return updated row from rpc', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseBudgetLineRepository(provider);

      const result = await repo.toggleCheckRpc('line-1');

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
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseBudgetLineRepository(provider);

      await expect(repo.toggleCheckRpc('line-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
