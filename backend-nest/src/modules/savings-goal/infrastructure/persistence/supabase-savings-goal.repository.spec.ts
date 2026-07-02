import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseSavingsGoalRepository } from './supabase-savings-goal.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { SavingsGoalRow } from '../../domain/savings-goal.entity';
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

const mockRow: SavingsGoalRow = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Maison',
  target_amount: 'enc:5000',
  target_date: '2099-01-01',
  priority: null,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  original_target_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

function createMockProvider(
  fromFn: (table: string) => unknown,
): AuthenticatedSupabaseProvider {
  const client = { from: fromFn } as unknown as AuthenticatedSupabaseClient;
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
    decryptAmount: jest.fn(),
    tryDecryptAmount: jest
      .fn()
      .mockImplementation((cipher: string | null, _dek: Buffer, fb: unknown) =>
        typeof cipher === 'string' && cipher.startsWith('enc:')
          ? Number(cipher.slice(4))
          : fb,
      ),
    encryptAmount: jest
      .fn()
      .mockImplementation((amount: number) => `enc:${amount}`),
    decryptRowAmountFields: jest.fn(),
    prepareAmountData: jest.fn(),
    prepareAmountsData: jest.fn(),
    encryptOptionalAmount: jest
      .fn()
      .mockImplementation((amount: number | null | undefined) =>
        Promise.resolve(amount == null ? null : `enc:${amount}`),
      ),
  } as unknown as EncryptionPort;
}

interface DbResult {
  data: unknown;
  error: unknown;
}

/**
 * Provider for `findLinkedContributions` — dispatches by table so the
 * budget_line line-query and the transaction follow-up query can each resolve
 * (or fail) independently, while recording whether/for which ids the
 * transaction round-trip fired.
 */
function createContributionsProvider(config: {
  lineResult: DbResult;
  txResult?: DbResult;
}): {
  provider: AuthenticatedSupabaseProvider;
  transactionQueried: () => boolean;
  transactionLineIds: () => string[] | undefined;
} {
  let queried = false;
  let capturedIds: string[] | undefined;
  const provider = createMockProvider((table: string) => {
    if (table === 'budget_line') {
      return {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve(config.lineResult) }),
        }),
      };
    }
    if (table === 'transaction') {
      queried = true;
      return {
        select: () => ({
          in: (_column: string, ids: string[]) => {
            capturedIds = ids;
            return Promise.resolve(
              config.txResult ?? { data: [], error: null },
            );
          },
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    provider,
    transactionQueried: () => queried,
    transactionLineIds: () => capturedIds,
  };
}

function createAuthProvider(
  userMetadata: Record<string, unknown> | undefined,
): AuthenticatedSupabaseProvider {
  const client = {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { user_metadata: userMetadata } } }),
    },
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

const linkedLineRow = {
  id: 'line-1',
  amount: 'enc:500',
  kind: 'saving' as const,
  checked_at: '2026-06-01T00:00:00Z',
  monthly_budget: { month: 6, year: 2026 },
};

describe('SupabaseSavingsGoalRepository', () => {
  it('findById decrypts target_amount (dedicated field, not generic)', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findById('goal-1');

    expect(result.targetAmount).toBe(5000); // decrypted from 'enc:5000'
    expect(result.originalTargetAmount).toBeNull();
    expect(result.status).toBe('ACTIVE');
  });

  it('findById throws BusinessException when not found (RLS-hidden)', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: () => ({
          single: jest
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'no rows' } }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
  });

  it('insert encrypts target_amount and stamps the authenticated user_id', async () => {
    let captured: Record<string, unknown> | undefined;
    const provider = createMockProvider(() => ({
      insert: (row: Record<string, unknown>) => {
        captured = row;
        return {
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        };
      },
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await repo.insert({
      name: 'Maison',
      targetAmount: 5000,
      targetDate: '2099-01-01',
      status: 'ACTIVE',
    });

    expect(captured?.target_amount).toBe('enc:5000'); // ciphertext, never plaintext
    expect(captured?.target_amount).not.toBe(5000);
    expect(captured?.user_id).toBe('user-1');
    expect(captured?.status).toBe('ACTIVE');
    expect('priority' in (captured ?? {})).toBe(false); // dropped from product
  });

  it('update maps real database errors to SAVINGS_GOAL_UPDATE_FAILED', async () => {
    const dbError = { message: 'violates check constraint' };
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    let caught: unknown;
    try {
      await repo.update('goal-1', { exchangeRate: 1.1 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_UPDATE_FAILED.code,
    );
    expect((caught as BusinessException).cause).toBe(dbError);
  });

  it('update maps a hidden or missing row to SAVINGS_GOAL_NOT_FOUND', async () => {
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    let caught: unknown;
    try {
      await repo.update('missing', { name: 'Maison' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
    );
    expect((caught as BusinessException).cause).toBeUndefined();
  });

  describe('findLinkedContributions', () => {
    it('decrypts amounts, renames checked_at→checkedAt, flattens monthly_budget month/year', async () => {
      const { provider } = createContributionsProvider({
        lineResult: { data: [linkedLineRow], error: null },
        txResult: {
          data: [
            {
              budget_line_id: 'line-1',
              amount: 'enc:120',
              kind: 'saving',
              checked_at: '2026-06-10T00:00:00Z',
            },
          ],
          error: null,
        },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const { lines, transactions } =
        await repo.findLinkedContributions('goal-1');

      expect(lines).toEqual([
        {
          id: 'line-1',
          amount: 500, // decrypted from 'enc:500'
          kind: 'saving',
          checkedAt: '2026-06-01T00:00:00Z',
          month: 6,
          year: 2026,
        },
      ]);
      expect(transactions).toEqual([
        {
          budgetLineId: 'line-1',
          amount: 120,
          kind: 'saving',
          checkedAt: '2026-06-10T00:00:00Z',
        },
      ]);
    });

    it('returns empty lines/transactions WITHOUT a transaction query when no line is linked', async () => {
      const { provider, transactionQueried } = createContributionsProvider({
        lineResult: { data: [], error: null },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findLinkedContributions('goal-1');

      expect(result).toEqual({ lines: [], transactions: [] });
      expect(transactionQueried()).toBe(false); // no ids → skip the round-trip
    });

    it('queries transactions only for the returned line ids', async () => {
      const { provider, transactionLineIds } = createContributionsProvider({
        lineResult: {
          data: [
            { ...linkedLineRow, id: 'line-1' },
            { ...linkedLineRow, id: 'line-2' },
          ],
          error: null,
        },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      await repo.findLinkedContributions('goal-1');

      expect(transactionLineIds()).toEqual(['line-1', 'line-2']);
    });

    it('wraps a line-query error in SAVINGS_GOAL_FETCH_FAILED', async () => {
      const dbError = { message: 'permission denied' };
      const { provider } = createContributionsProvider({
        lineResult: { data: null, error: dbError },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findLinkedContributions('goal-1');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED.code,
      );
      expect((caught as BusinessException).cause).toBe(dbError);
    });

    it('wraps a transaction-query error in TRANSACTION_FETCH_FAILED', async () => {
      const dbError = { message: 'statement timeout' };
      const { provider } = createContributionsProvider({
        lineResult: { data: [linkedLineRow], error: null },
        txResult: { data: null, error: dbError },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findLinkedContributions('goal-1');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED.code,
      );
      expect((caught as BusinessException).cause).toBe(dbError);
    });
  });

  describe('findPayDayOfMonth', () => {
    it('returns the payDayOfMonth from user_metadata', async () => {
      const repo = new SupabaseSavingsGoalRepository(
        createAuthProvider({ payDayOfMonth: 25 }),
        createMockEncryption(),
      );
      expect(await repo.findPayDayOfMonth()).toBe(25);
    });

    it('clamps an out-of-range payDayOfMonth into [PAY_DAY_MIN, PAY_DAY_MAX]', async () => {
      const repo = new SupabaseSavingsGoalRepository(
        createAuthProvider({ payDayOfMonth: 40 }),
        createMockEncryption(),
      );
      expect(await repo.findPayDayOfMonth()).toBe(31); // PAY_DAY_MAX
    });

    it('returns null when payDayOfMonth is absent', async () => {
      const repo = new SupabaseSavingsGoalRepository(
        createAuthProvider({}),
        createMockEncryption(),
      );
      expect(await repo.findPayDayOfMonth()).toBeNull();
    });

    it('returns null when payDayOfMonth is not an integer', async () => {
      const repo = new SupabaseSavingsGoalRepository(
        createAuthProvider({ payDayOfMonth: 15.5 }),
        createMockEncryption(),
      );
      expect(await repo.findPayDayOfMonth()).toBeNull();
    });
  });
});
