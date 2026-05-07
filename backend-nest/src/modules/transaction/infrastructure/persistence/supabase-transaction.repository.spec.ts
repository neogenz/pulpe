import { describe, it, expect, jest } from 'bun:test';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionRow } from '../../domain/transaction.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';

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

describe('SupabaseTransactionRepository', () => {
  let repo: SupabaseTransactionRepository;

  describe('findById', () => {
    it('should return a transaction row on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(provider);

      const result = await repo.findById('txn-1');

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
      repo = new SupabaseTransactionRepository(provider);

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
      repo = new SupabaseTransactionRepository(provider);

      const result = await repo.insert({
        budget_id: 'budget-1',
        name: 'Restaurant',
        amount: 'encrypted',
        kind: 'expense',
        transaction_date: '2024-01-15T12:00:00Z',
      });

      expect(result).toEqual(mockRow);
    });

    it('should throw TRANSACTION_ALREADY_EXISTS on 23505 error', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'Duplicate key' },
            }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(provider);

      await expect(
        repo.insert({
          budget_id: 'budget-1',
          name: 'Restaurant',
          amount: 'encrypted',
          kind: 'expense',
          transaction_date: '2024-01-15T12:00:00Z',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw TRANSACTION_CREATE_FAILED on generic error', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '42000', message: 'DB error' },
            }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(provider);

      await expect(
        repo.insert({
          budget_id: 'budget-1',
          name: 'Restaurant',
          amount: 'encrypted',
          kind: 'expense',
          transaction_date: '2024-01-15T12:00:00Z',
        }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should resolve without error on success', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));
      repo = new SupabaseTransactionRepository(provider);

      await expect(repo.delete('txn-1')).resolves.toBeUndefined();
    });

    it('should throw BusinessException when delete fails', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Row not found' },
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(provider);

      await expect(repo.delete('missing')).rejects.toThrow(BusinessException);
    });
  });
});
