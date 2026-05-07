import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionRow } from '../../domain/transaction.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

const mockRow: TransactionRow = {
  id: 'txn-1',
  budget_id: 'budget-1',
  budget_line_id: null,
  amount: 'encrypted',
  name: 'Restaurant',
  kind: 'expense' as const,
  transaction_date: '2024-01-15T12:00:00Z',
  category: null,
  checked_at: null,
  created_at: '2024-01-15T12:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

function createMockSupabase(
  fromFn: (table: string) => unknown,
): AuthenticatedSupabaseClient {
  return {
    from: fromFn,
    rpc: jest.fn(),
  } as unknown as AuthenticatedSupabaseClient;
}

describe('SupabaseTransactionRepository', () => {
  let repo: SupabaseTransactionRepository;

  beforeEach(() => {
    repo = new SupabaseTransactionRepository();
  });

  describe('findById', () => {
    it('should return a transaction row on success', async () => {
      const supabase = createMockSupabase(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));

      const result = await repo.findById('txn-1', supabase);

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
          name: 'Restaurant',
          amount: 'encrypted',
          kind: 'expense',
          transaction_date: '2024-01-15T12:00:00Z',
        },
        supabase,
      );

      expect(result).toEqual(mockRow);
    });

    it('should throw TRANSACTION_ALREADY_EXISTS on 23505 error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'Duplicate key' },
            }),
          }),
        }),
      }));

      await expect(
        repo.insert(
          {
            budget_id: 'budget-1',
            name: 'Restaurant',
            amount: 'encrypted',
            kind: 'expense',
            transaction_date: '2024-01-15T12:00:00Z',
          },
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw TRANSACTION_CREATE_FAILED on generic error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '42000', message: 'DB error' },
            }),
          }),
        }),
      }));

      await expect(
        repo.insert(
          {
            budget_id: 'budget-1',
            name: 'Restaurant',
            amount: 'encrypted',
            kind: 'expense',
            transaction_date: '2024-01-15T12:00:00Z',
          },
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should resolve without error on success', async () => {
      const supabase = createMockSupabase(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));

      await expect(repo.delete('txn-1', supabase)).resolves.toBeUndefined();
    });

    it('should throw BusinessException when delete fails', async () => {
      const supabase = createMockSupabase(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Row not found' },
          }),
        }),
      }));

      await expect(repo.delete('missing', supabase)).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
