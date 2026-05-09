import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetLineRepository } from './supabase-budget-line.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type {
  BudgetLine,
  BudgetLineRow,
} from '../../domain/budget-line.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

      await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
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
      repo = new SupabaseBudgetLineRepository(provider, encryption);

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
  });

  describe('delete', () => {
    it('should resolve on success', async () => {
      const provider = createMockProvider(() => ({
        delete: () => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }));
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

      await expect(repo.delete('line-1')).rejects.toThrow(BusinessException);
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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

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
  });

  describe('toggleCheckRpc', () => {
    it('should return decrypted entity from rpc', async () => {
      const mockRpc = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      const provider = createMockProvider(() => ({}), mockRpc);
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

      const result = await repo.toggleCheckRpc('line-1');

      expect(result).toEqual(expectedEntity);
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
      repo = new SupabaseBudgetLineRepository(provider, createMockEncryption());

      await expect(repo.toggleCheckRpc('line-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
