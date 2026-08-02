import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionRow } from '../../domain/transaction.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';

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
  checked_at: null,
  created_at: '2024-01-15T12:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
  source_savings_goal_id: null,
  source_savings_goal_name: null,
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

function createMockLogger(): InfoLogger {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
  } as unknown as InfoLogger;
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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

    it('should link provided tagIds via atomic replace RPC and return them on the entity', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ error: null });
      const provider = createMockProvider(
        () => ({
          insert: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        }),
        mockRpc,
      );
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.insert({
        budgetId: 'budget-1',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        tagIds: ['tag-1', 'tag-2'],
        transactionDate: '2024-01-15T12:00:00Z',
      });

      expect(mockRpc).toHaveBeenCalledWith('replace_transaction_tags', {
        p_transaction_id: 'txn-1',
        p_tag_ids: ['tag-1', 'tag-2'],
      });
      expect(result.tagIds).toEqual(['tag-1', 'tag-2']);
    });

    it('should map FK violation on tag link to TAG_NOT_FOUND and delete the created transaction', async () => {
      const compensationDeletes: string[] = [];
      const mockRpc = jest.fn().mockResolvedValue({
        error: { code: '23503', message: 'FK violation' },
      });
      const provider = createMockProvider(() => {
        return {
          insert: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
          delete: () => ({
            eq: (column: string, value: string) => {
              compensationDeletes.push(`${column}=${value}`);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }, mockRpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Restaurant',
          amount: 50,
          kind: 'expense',
          tagIds: ['foreign-tag'],
          transactionDate: '2024-01-15T12:00:00Z',
        }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
      expect(compensationDeletes).toEqual(['id=txn-1']);
    });

    it('should warn when tag-link compensation delete fails and rethrow the tag error', async () => {
      const tagError = { code: '23503', message: 'FK violation' };
      const cleanupError = { code: '08006', message: 'connection lost' };
      const logger = createMockLogger();
      const provider = createMockProvider(
        () => ({
          insert: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
          delete: () => ({
            eq: jest.fn().mockResolvedValue({ error: cleanupError }),
          }),
        }),
        jest.fn().mockResolvedValue({ error: tagError }),
      );
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        logger,
      );

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Restaurant',
          amount: 50,
          kind: 'expense',
          transactionDate: '2024-01-15T12:00:00Z',
          tagIds: ['missing-tag'],
        }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
      expect(logger.warn).toHaveBeenCalledWith(
        {
          operation: 'createTransaction.compensateTagFailure',
          entityId: 'txn-1',
          err: cleanupError,
        },
        'Failed to delete transaction after tag linking failure',
      );
    });
  });

  describe('update', () => {
    it('should update scalar fields and tags in one atomic RPC', async () => {
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({ data: mockRow, error: null });
      const provider = createMockProvider(from, rpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.update('txn-1', {
        name: 'Updated',
        amount: 75,
        tagIds: ['tag-1'],
      });

      expect(rpc).toHaveBeenCalledWith('update_transaction_with_tags', {
        p_transaction_id: 'txn-1',
        p_patch: {
          amount: 'encrypted',
          name: 'Updated',
          updated_at: expect.any(String),
        },
        p_tag_ids: ['tag-1'],
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
      expect(result.tagIds).toEqual(['tag-1']);
    });

    it('should use the same atomic RPC for a tags-only patch', async () => {
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({ data: mockRow, error: null });
      const provider = createMockProvider(from, rpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.update('txn-1', { tagIds: ['tag-1'] });

      expect(rpc).toHaveBeenCalledWith('update_transaction_with_tags', {
        p_transaction_id: 'txn-1',
        p_patch: {
          updated_at: expect.any(String),
        },
        p_tag_ids: ['tag-1'],
      });
      expect(from).not.toHaveBeenCalled();
      expect(result.tagIds).toEqual(['tag-1']);
    });

    it('should not fall back to a scalar update when the atomic RPC rejects a tag', async () => {
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'FK violation' },
      });
      const provider = createMockProvider(from, rpc);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.update('txn-1', { name: 'Updated', tagIds: ['missing-tag'] }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
      expect(from).not.toHaveBeenCalled();
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
        createMockLogger(),
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
        createMockLogger(),
      );

      await expect(repo.delete('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('toggleCheck (atomic RPC)', () => {
    it('should return decrypted entity with refetched tagIds from atomic RPC call', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      const provider = createMockProvider(
        () => ({
          select: () => ({
            eq: jest.fn().mockResolvedValue({
              data: [{ tag_id: 'tag-1' }],
              error: null,
            }),
          }),
        }),
        mockRpc,
      );
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.toggleCheck('txn-1');

      expect(result.id).toBe('txn-1');
      expect(result.amount).toBe(50);
      expect(result.tagIds).toEqual(['tag-1']);
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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
        createMockLogger(),
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

  describe('fetchTransactionsByPattern', () => {
    const searchRow = (id: string, date: string) => ({
      id,
      name: `Transaction ${id}`,
      amount: 'encrypted',
      kind: 'expense',
      transaction_date: date,
      budget_id: 'budget-1',
      budget: { description: 'Juillet', month: 7, year: 2026 },
    });

    function transactionQuery(data: unknown[]) {
      const query = {
        select: jest.fn(),
        ilike: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        overrideTypes: jest.fn().mockResolvedValue({ data, error: null }),
      };
      query.select.mockReturnValue(query);
      query.ilike.mockReturnValue(query);
      query.in.mockReturnValue(query);
      query.order.mockReturnValue(query);
      query.limit.mockReturnValue(query);
      return query;
    }

    it('returns transactions whose tag name matches even when their own name does not', async () => {
      const byName = transactionQuery([]);
      const byTag = transactionQuery([
        searchRow('txn-tagged', '2026-07-10T00:00:00.000Z'),
      ]);
      let transactionQueryIndex = 0;
      const provider = createMockProvider((table) => {
        if (table === 'tag') {
          const tagQuery = {
            eq: jest.fn(),
            ilike: jest.fn().mockResolvedValue({
              data: [{ id: 'tag-groceries' }],
              error: null,
            }),
          };
          tagQuery.eq.mockReturnValue(tagQuery);
          return {
            select: () => tagQuery,
          };
        }
        return transactionQueryIndex++ === 0 ? byName : byTag;
      });
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchTransactionsByPattern({
        userId: 'user-1',
        searchPattern: '%courses%',
        budgetIds: null,
        tagIds: [],
      });

      expect(result.map(({ id }) => id)).toEqual(['txn-tagged']);
      expect(byTag.in).toHaveBeenCalledWith('transaction_tag.tag_id', [
        'tag-groceries',
      ]);
    });

    it('deduplicates name and tag matches, keeps newest first, and scopes both paths to the selected years', async () => {
      const byName = transactionQuery([
        searchRow('txn-shared', '2026-07-10T00:00:00.000Z'),
        searchRow('txn-name', '2026-07-01T00:00:00.000Z'),
      ]);
      const byTag = transactionQuery([
        searchRow('txn-tag', '2026-07-15T00:00:00.000Z'),
        searchRow('txn-shared', '2026-07-10T00:00:00.000Z'),
      ]);
      let transactionQueryIndex = 0;
      const provider = createMockProvider((table) => {
        if (table === 'tag') {
          const tagQuery = {
            eq: jest.fn(),
            ilike: jest.fn().mockResolvedValue({
              data: [{ id: 'tag-groceries' }],
              error: null,
            }),
          };
          tagQuery.eq.mockReturnValue(tagQuery);
          return {
            select: () => tagQuery,
          };
        }
        return transactionQueryIndex++ === 0 ? byName : byTag;
      });
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchTransactionsByPattern({
        userId: 'user-1',
        searchPattern: '%courses%',
        budgetIds: ['budget-1', 'budget-2'],
        tagIds: [],
      });

      expect(result.map(({ id }) => id)).toEqual([
        'txn-tag',
        'txn-shared',
        'txn-name',
      ]);
      expect(byName.in).toHaveBeenCalledWith('budget_id', [
        'budget-1',
        'budget-2',
      ]);
      expect(byTag.in).toHaveBeenCalledWith('budget_id', [
        'budget-1',
        'budget-2',
      ]);
    });

    it('combines text and exact tags in one query', async () => {
      const query = transactionQuery([
        searchRow('txn-shared', '2026-07-10T00:00:00.000Z'),
      ]);
      const provider = createMockProvider((table) => {
        if (table === 'tag') {
          const tagQuery = {
            eq: jest.fn(),
            ilike: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
          tagQuery.eq.mockReturnValue(tagQuery);
          return { select: () => tagQuery };
        }
        return query;
      });
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchTransactionsByPattern({
        userId: 'user-1',
        searchPattern: '%courses%',
        budgetIds: null,
        tagIds: ['tag-food'],
      });

      expect(result.map(({ id }) => id)).toEqual(['txn-shared']);
      expect(query.in).toHaveBeenCalledWith('transaction_tag.tag_id', [
        'tag-food',
      ]);
      expect(query.ilike).toHaveBeenCalledWith('name', '%courses%');
    });

    it('keeps tag-name text matches when an exact tag filter is selected', async () => {
      const byName = transactionQuery([]);
      const byTextTag = transactionQuery([
        searchRow('txn-shared', '2026-07-10T00:00:00.000Z'),
      ]);
      const tagQuery = {
        eq: jest.fn(),
        ilike: jest.fn().mockResolvedValue({
          data: [{ id: 'tag-groceries' }],
          error: null,
        }),
      };
      tagQuery.eq.mockReturnValue(tagQuery);
      let transactionQueryIndex = 0;
      const provider = createMockProvider((table) => {
        if (table === 'tag') {
          return { select: () => tagQuery };
        }
        return transactionQueryIndex++ === 0 ? byName : byTextTag;
      });
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchTransactionsByPattern({
        userId: 'user-1',
        searchPattern: '%courses%',
        budgetIds: null,
        tagIds: ['tag-home'],
      });

      expect(result.map(({ id }) => id)).toEqual(['txn-shared']);
      expect(byTextTag.in).toHaveBeenCalledWith('selected_tags.tag_id', [
        'tag-home',
      ]);
      expect(byTextTag.in).toHaveBeenCalledWith('text_tags.tag_id', [
        'tag-groceries',
      ]);
    });
  });

  describe('fetchBudgetLinesByPattern', () => {
    const searchRow = (id: string) => ({
      id,
      name: `Budget line ${id}`,
      amount: 'encrypted',
      kind: 'expense',
      recurrence: 'fixed',
      budget_id: 'budget-1',
      budget: { description: 'Juillet', month: 7, year: 2026 },
    });

    function budgetLineQuery(data: unknown[]) {
      const query = {
        select: jest.fn(),
        ilike: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        limit: jest.fn().mockResolvedValue({ data, error: null }),
      };
      query.select.mockReturnValue(query);
      query.ilike.mockReturnValue(query);
      query.in.mockReturnValue(query);
      query.order.mockReturnValue(query);
      return query;
    }

    it('combines text, budget, and exact tag filters in one query', async () => {
      const bySelectedTag = budgetLineQuery([searchRow('line-selected')]);
      const provider = createMockProvider(() => bySelectedTag);
      repo = new SupabaseTransactionRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchBudgetLinesByPattern({
        userId: 'user-1',
        searchPattern: '%courses%',
        budgetIds: ['budget-1'],
        tagIds: ['tag-food', 'tag-home'],
      });

      expect(result.map(({ id }) => id)).toEqual(['line-selected']);
      expect(bySelectedTag.in).toHaveBeenCalledWith('budget_line_tag.tag_id', [
        'tag-food',
        'tag-home',
      ]);
      expect(bySelectedTag.ilike).toHaveBeenCalledWith('name', '%courses%');
      expect(bySelectedTag.in).toHaveBeenCalledWith('budget_id', ['budget-1']);
    });
  });
});
