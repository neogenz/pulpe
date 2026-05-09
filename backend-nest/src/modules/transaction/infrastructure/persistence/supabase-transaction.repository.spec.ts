import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionRow } from '../../domain/transaction.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

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

function createMockEncryption(): EncryptionPort {
  const dek = Buffer.from('dek');
  return {
    ensureUserDEK: jest.fn().mockResolvedValue(dek),
    getUserDEK: jest.fn().mockResolvedValue(dek),
    getDekFor: jest.fn().mockResolvedValue(dek),
    decryptAmount: jest.fn().mockReturnValue(50),
    tryDecryptAmount: jest.fn().mockReturnValue(50),
    encryptAmount: jest.fn().mockReturnValue('encrypted'),
    decryptRowAmountFields: jest.fn().mockImplementation((row) => ({
      ...row,
      amount: 50,
      original_amount: null,
    })),
    prepareAmountData: jest.fn().mockResolvedValue({ amount: 'encrypted' }),
    prepareAmountsData: jest.fn().mockResolvedValue([{ amount: 'encrypted' }]),
    encryptOptionalAmount: jest.fn().mockResolvedValue(null),
  } as unknown as EncryptionPort;
}

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
      return mockUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

describe('SupabaseTransactionRepository', () => {
  let repo: SupabaseTransactionRepository;

  describe('findById', () => {
    it('should return a decrypted entity on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findById('txn-1');

      expect(result.id).toBe('txn-1');
      expect(result.budgetId).toBe('budget-1');
      expect(result.amount).toBe(50);
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
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('insert', () => {
    it('should return inserted entity on success', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.insert({
        budgetId: 'budget-1',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15T12:00:00Z',
      });

      expect(result.id).toBe('txn-1');
      expect(result.amount).toBe(50);
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
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Restaurant',
          amount: 50,
          kind: 'expense',
          transactionDate: '2024-01-15T12:00:00Z',
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
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Restaurant',
          amount: 50,
          kind: 'expense',
          transactionDate: '2024-01-15T12:00:00Z',
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
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

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
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      await expect(repo.delete('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('toggleCheck (atomic RPC)', () => {
    it('should return decrypted entity from atomic RPC call', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.toggleCheck('txn-1');

      expect(result.id).toBe('txn-1');
      expect(result.amount).toBe(50);
      expect(mockRpc).toHaveBeenCalledWith('toggle_transaction_check', {
        p_transaction_id: 'txn-1',
      });
      // Atomicity guarantee: single RPC call, no separate read+write
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('should throw TRANSACTION_NOT_FOUND (404) when RPC raises "not found or access denied"', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Transaction not found or access denied' },
        }),
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      try {
        await repo.toggleCheck('txn-1');
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TRANSACTION_NOT_FOUND',
        );
        expect((error as BusinessException).getStatus()).toBe(404);
      }
    });

    it('should throw TRANSACTION_UPDATE_FAILED (500) on genuine RPC failure', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection timeout' },
        }),
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      try {
        await repo.toggleCheck('txn-1');
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TRANSACTION_UPDATE_FAILED',
        );
        expect((error as BusinessException).getStatus()).toBe(500);
      }
    });
  });

  describe('fetchBudgetIdForTransaction', () => {
    it('should return the budget id on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { budget_id: 'budget-1' },
              error: null,
            }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.fetchBudgetIdForTransaction('txn-1');

      expect(result).toBe('budget-1');
    });

    it('should return null when row not found (PGRST116)', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows' },
            }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.fetchBudgetIdForTransaction('missing');

      expect(result).toBeNull();
    });

    it('should throw TRANSACTION_FETCH_FAILED on real error', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '42000', message: 'DB connection lost' },
            }),
          }),
        }),
      }));
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
      );

      try {
        await repo.fetchBudgetIdForTransaction('txn-1');
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TRANSACTION_FETCH_FAILED',
        );
      }
    });
  });
});
