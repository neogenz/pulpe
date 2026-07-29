import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetLineRepository } from './supabase-budget-line.repository';
import { SupabaseBudgetLineSpreadReader } from './supabase-budget-line-spread.reader';
import {
  SPREAD_GROUP_EXISTS_RPC_MESSAGE,
  SPREAD_SOURCE_UNAVAILABLE_RPC_MESSAGE,
} from './schemas/rpc-payload.schemas';
import { SpreadGroupAlreadyExistsError } from '../../domain/spread-group-conflict.error';
import { BusinessException } from '@common/exceptions/business.exception';
import type {
  BudgetLine,
  BudgetLineRow,
  SpreadOccurrence,
} from '../../domain/budget-line.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const mockRow: BudgetLineRow = {
  id: 'line-1',
  budget_id: 'budget-1',
  template_line_id: null,
  savings_goal_id: null,
  spread_group_id: null,
  savings_withdrawal_group_id: null,
  name: 'Loyer',
  amount: 'encrypted-1200',
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

const expectedEntity: BudgetLine = {
  id: 'line-1',
  budgetId: 'budget-1',
  templateLineId: null,
  savingsGoalId: null,
  tagIds: [],
  spreadGroupId: null,
  savingsWithdrawalGroupId: null,
  name: 'Loyer',
  amount: 1200,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
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
      return mockUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

function createMockEncryption(): EncryptionPort {
  return {
    getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    ensureUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
    decryptAmount: jest.fn().mockReturnValue(1200),
    tryDecryptAmount: jest.fn().mockReturnValue(1200),
    encryptAmount: jest.fn().mockReturnValue('encrypted-1200'),
    decryptRowAmountFields: jest.fn().mockImplementation((row) => ({
      ...row,
      amount: 1200,
      original_amount: null,
    })),
    prepareAmountData: jest
      .fn()
      .mockResolvedValue({ amount: 'encrypted-1200' }),
    prepareAmountsData: jest
      .fn()
      .mockResolvedValue([{ amount: 'encrypted-1200' }]),
    encryptOptionalAmount: jest.fn().mockResolvedValue(null),
  } as unknown as EncryptionPort;
}

function createMockLogger(): InfoLogger {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
  } as unknown as InfoLogger;
}

function createMockSpreadReader(): SupabaseBudgetLineSpreadReader {
  return {
    findOccurrences: jest.fn().mockResolvedValue([]),
  } as unknown as SupabaseBudgetLineSpreadReader;
}

function createRepository(
  provider: AuthenticatedSupabaseProvider,
  encryption: EncryptionPort,
  logger: InfoLogger,
  spreadReader = createMockSpreadReader(),
): SupabaseBudgetLineRepository {
  return new SupabaseBudgetLineRepository(
    provider,
    encryption,
    logger,
    spreadReader,
  );
}

describe('SupabaseBudgetLineRepository', () => {
  let repo: SupabaseBudgetLineRepository;

  describe('findById', () => {
    it('should return decrypted entity on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.findById('line-1');

      expect(result).toEqual(expectedEntity);
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('validateAccess', () => {
    it('should resolve when budget line belongs to user', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockRow, monthly_budget: { user_id: mockUser.id } },
              error: null,
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.validateAccess('line-1', mockUser.id)).resolves.toBe(
        undefined,
      );
    });

    it('should throw when budget line belongs to another user', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockRow, monthly_budget: { user_id: 'user-2' } },
              error: null,
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.validateAccess('line-1', mockUser.id),
      ).rejects.toMatchObject({
        code: 'ERR_BUDGET_LINE_NOT_FOUND',
        cause: undefined,
        loggingContext: {
          operation: 'validateAccess',
          entityId: 'line-1',
          entityType: 'budget_line',
          userId: mockUser.id,
          supabaseError: null,
          reason: 'user_mismatch',
        },
      });
    });

    it('should throw with context and cause when supabase returns an error', async () => {
      const supabaseError = {
        message: 'connection error',
        code: 'PGRST_CONN',
      };
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: supabaseError,
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.validateAccess('line-1', mockUser.id),
      ).rejects.toMatchObject({
        code: 'ERR_BUDGET_LINE_NOT_FOUND',
        cause: supabaseError,
        loggingContext: {
          operation: 'validateAccess',
          entityId: 'line-1',
          entityType: 'budget_line',
          userId: mockUser.id,
          supabaseError,
        },
      });
    });
  });

  describe('insert', () => {
    it('should encrypt amount and return decrypted entity on success', async () => {
      const provider = createMockProvider(() => ({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      }));
      const encryption = createMockEncryption();
      repo = createRepository(provider, encryption, createMockLogger());

      const result = await repo.insert({
        budgetId: 'budget-1',
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      });

      expect(result).toEqual(expectedEntity);
      expect(encryption.prepareAmountData).toHaveBeenCalledWith(
        1200,
        mockUser.id,
        mockUser.clientKey,
      );
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
        }),
      ).rejects.toThrow(BusinessException);
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
      repo = createRepository(provider, createMockEncryption(), logger);

      await expect(
        repo.insert({
          budgetId: 'budget-1',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          tagIds: ['missing-tag'],
        }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
      expect(logger.warn).toHaveBeenCalledWith(
        {
          operation: 'createBudgetLine.compensateTagFailure',
          entityId: 'line-1',
          err: cleanupError,
        },
        'Failed to delete budget line after tag linking failure',
      );
    });
  });

  describe('delete', () => {
    it('should resolve on success', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.delete('line-1')).resolves.toBeUndefined();
    });

    it('should throw BUDGET_LINE_DELETE_FAILED with cause when deletion fails', async () => {
      const dbError = { code: '08006', message: 'connection lost' };
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({
            error: dbError,
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.delete('line-1');
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        const businessError = error as BusinessException;
        expect(businessError.code).toBe('ERR_BUDGET_LINE_DELETE_FAILED');
        expect(businessError.getStatus()).toBe(500);
        expect(businessError.cause).toBe(dbError);
        expect(businessError.loggingContext.supabaseError).toBe(dbError);
      }
    });
  });

  describe('fetchBudgetIdForLine', () => {
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchBudgetIdForLine('line-1');

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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.fetchBudgetIdForLine('missing');

      expect(result).toBeNull();
    });

    it('should throw BUDGET_LINE_FETCH_FAILED on real error', async () => {
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.fetchBudgetIdForLine('line-1');
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_FETCH_FAILED',
        );
      }
    });
  });

  describe('update', () => {
    it('should return decrypted entity on success', async () => {
      const provider = createMockProvider(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.update('line-1', { name: 'Updated' });

      expect(result).toEqual(expectedEntity);
    });

    it('should throw BUDGET_LINE_NOT_FOUND on PGRST116', async () => {
      const provider = createMockProvider(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows' },
              }),
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.update('missing', { name: 'X' });
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_NOT_FOUND',
        );
      }
    });

    it('should throw BUDGET_LINE_ALREADY_EXISTS on 23505', async () => {
      const provider = createMockProvider(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: '23505', message: 'Unique violation' },
              }),
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.update('line-1', { name: 'X' });
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_ALREADY_EXISTS',
        );
      }
    });

    it('should throw BUDGET_LINE_UPDATE_FAILED on generic error', async () => {
      const provider = createMockProvider(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: '42000', message: 'DB error' },
              }),
            }),
          }),
        }),
      }));
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.update('line-1', { name: 'X' });
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_UPDATE_FAILED',
        );
      }
    });

    it('should update scalar fields and tags in one atomic RPC', async () => {
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({ data: mockRow, error: null });
      const provider = createMockProvider(from, rpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.update('line-1', {
        name: 'Updated',
        amount: 900,
        tagIds: ['tag-1'],
      });

      expect(rpc).toHaveBeenCalledWith('update_budget_line_with_tags', {
        p_budget_line_id: 'line-1',
        p_patch: {
          amount: 'encrypted-1200',
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.update('line-1', { tagIds: ['tag-1'] });

      expect(rpc).toHaveBeenCalledWith('update_budget_line_with_tags', {
        p_budget_line_id: 'line-1',
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.update('line-1', { name: 'Updated', tagIds: ['missing-tag'] }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
      expect(from).not.toHaveBeenCalled();
    });

    it('maps the savings-goal link trigger rejection to SAVINGS_GOAL_NOT_FOUND (4xx), not a 500', async () => {
      // Stale picker scenario: the goal was deleted in another tab, the PATCH
      // still carries its id — the DB trigger rejects with P0001.
      const provider = createMockProvider(
        () => ({}),
        jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'P0001',
            message: 'Savings goal access denied',
          },
        }),
      );
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.update('line-1', {
          savingsGoalId: 'deleted-goal',
          tagIds: ['tag-1'],
        });
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_SAVINGS_GOAL_NOT_FOUND',
        );
      }
    });
  });

  describe('findSpreadSource', () => {
    it('returns the savings-goal link needed by spread-from-line', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: {
                ...mockRow,
                savings_goal_id: 'goal-1',
                monthly_budget: {
                  month: 1,
                  year: 2026,
                  user_id: mockUser.id,
                },
              },
              error: null,
            }),
          }),
        }),
      }));
      const encryption = createMockEncryption();
      encryption.decryptRowAmountFields = jest
        .fn()
        .mockImplementation((row) => ({
          ...row,
          amount: 1200,
          original_amount: null,
        }));
      repo = createRepository(provider, encryption, createMockLogger());

      const source = await repo.findSpreadSource('line-1');

      expect(source.savingsGoalId).toBe('goal-1');
    });
  });

  describe('createSpread', () => {
    const spreadGroupId = 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const spreadInput = {
      budgetId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Prime assurance',
      amount: 100,
      kind: 'expense' as const,
      recurrence: 'one_off' as const,
    };

    function createSpreadRpc(): jest.Mock {
      return jest.fn().mockResolvedValue({ data: [mockRow], error: null });
    }

    it('passes neither source id when no source descriptor is given (additive create)', async () => {
      const mockRpc = createSpreadRpc();
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await repo.createSpread(spreadGroupId, [spreadInput]);

      expect(mockRpc).toHaveBeenCalledWith(
        'create_budget_lines_spread',
        expect.objectContaining({
          p_source_budget_line_id: undefined,
          p_source_transaction_id: undefined,
        }),
      );
    });

    it('maps a budget_line source to p_source_budget_line_id only', async () => {
      const mockRpc = createSpreadRpc();
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await repo.createSpread(spreadGroupId, [spreadInput], {
        type: 'budget_line',
        id: 'source-line-1',
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'create_budget_lines_spread',
        expect.objectContaining({
          p_source_budget_line_id: 'source-line-1',
          p_source_transaction_id: undefined,
        }),
      );
    });

    it('maps a transaction source to p_source_transaction_id only', async () => {
      const mockRpc = createSpreadRpc();
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await repo.createSpread(spreadGroupId, [spreadInput], {
        type: 'transaction',
        id: 'source-txn-1',
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'create_budget_lines_spread',
        expect.objectContaining({
          p_source_budget_line_id: undefined,
          p_source_transaction_id: 'source-txn-1',
        }),
      );
    });

    it('forwards the spread group id and returns decrypted entities', async () => {
      const mockRpc = createSpreadRpc();
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.createSpread(spreadGroupId, [spreadInput]);

      expect(mockRpc).toHaveBeenCalledWith(
        'create_budget_lines_spread',
        expect.objectContaining({ p_spread_group_id: spreadGroupId }),
      );
      expect(result).toEqual([expectedEntity]);
    });

    it('throws BusinessException when the spread rpc fails', async () => {
      const mockRpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'RPC error' } });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.createSpread(spreadGroupId, [spreadInput]),
      ).rejects.toThrow(BusinessException);
    });

    it('maps a rejected savings-goal link to SAVINGS_GOAL_NOT_FOUND', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'Savings goal access denied',
        },
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.createSpread(spreadGroupId, [
          {
            ...spreadInput,
            kind: 'saving',
            savingsGoalId: '550e8400-e29b-41d4-a716-446655440000',
          },
        ]),
      ).rejects.toMatchObject({ code: 'ERR_SAVINGS_GOAL_NOT_FOUND' });
    });

    it('maps a spread past the goal deadline to a dedicated 422', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'Savings goal line outside target horizon',
        },
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.createSpread(spreadGroupId, [spreadInput]);
        throw new Error('Expected createSpread to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_SAVINGS_GOAL_LINE_OUTSIDE_HORIZON',
        );
        expect((error as BusinessException).getStatus()).toBe(422);
      }
    });

    it('maps a consumed source (concurrent retry) to a 409 conflict', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: SPREAD_SOURCE_UNAVAILABLE_RPC_MESSAGE },
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.createSpread(spreadGroupId, [spreadInput], {
          type: 'budget_line',
          id: 'source-line-1',
        });
        throw new Error('Expected createSpread to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_ALREADY_SPREAD',
        );
        expect((error as BusinessException).getStatus()).toBe(409);
      }
    });

    it('maps the dup-group guard to a typed SpreadGroupAlreadyExistsError (idempotent replay signal)', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: SPREAD_GROUP_EXISTS_RPC_MESSAGE },
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      try {
        await repo.createSpread(spreadGroupId, [spreadInput]);
        throw new Error('Expected createSpread to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SpreadGroupAlreadyExistsError);
        expect((error as SpreadGroupAlreadyExistsError).spreadGroupId).toBe(
          spreadGroupId,
        );
      }
    });
  });

  describe('toggleCheckRpc', () => {
    it('should return decrypted entity with refetched tagIds from rpc', async () => {
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.toggleCheckRpc('line-1');

      expect(result).toEqual({ ...expectedEntity, tagIds: ['tag-1'] });
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
      repo = createRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.toggleCheckRpc('line-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('findBySpreadGroupId', () => {
    it('delegates spread occurrence reads to the dedicated reader', async () => {
      const occurrences = [
        { budgetLineId: 'line-1' },
      ] as unknown as SpreadOccurrence[];
      const findOccurrences = jest.fn().mockResolvedValue(occurrences);
      const spreadReader = {
        findOccurrences,
      } as unknown as SupabaseBudgetLineSpreadReader;
      repo = createRepository(
        createMockProvider(() => ({})),
        createMockEncryption(),
        createMockLogger(),
        spreadReader,
      );

      const result = await repo.findBySpreadGroupId('grp-1');

      expect(result).toBe(occurrences);
      expect(findOccurrences).toHaveBeenCalledWith('grp-1');
    });
  });
});
