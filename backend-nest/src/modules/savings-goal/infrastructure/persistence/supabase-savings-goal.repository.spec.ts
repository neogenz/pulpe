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
  start_date: null,
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
  initial_amount: null,
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

function createFindByIdProvider(result: unknown) {
  const eq = jest.fn();
  const query = {
    eq,
    single: jest.fn().mockResolvedValue(result),
  };
  eq.mockReturnValue(query);
  return {
    provider: createMockProvider(() => ({ select: () => query })),
    eq,
  };
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
    decryptRowAmountFields: jest
      .fn()
      .mockImplementation(
        (row: { amount: string | null; original_amount: string | null }) => ({
          ...row,
          amount:
            typeof row.amount === 'string' && row.amount.startsWith('enc:')
              ? Number(row.amount.slice(4))
              : 0,
          original_amount:
            typeof row.original_amount === 'string' &&
            row.original_amount.startsWith('enc:')
              ? Number(row.original_amount.slice(4))
              : null,
        }),
      ),
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

/**
 * Provider for `findContributions` — the budget_line query returns the linked
 * saving lines (with their budget period), then the transaction query resolves
 * `.in(...).order(...)`. Records the ordering args + the queried line ids.
 */
function createGoalContributionsProvider(config: {
  lineResult: DbResult;
  txResult?: DbResult;
}): {
  provider: AuthenticatedSupabaseProvider;
  orderArgs: () => [string, { ascending: boolean }] | undefined;
  transactionLineIds: () => string[] | undefined;
} {
  let capturedOrder: [string, { ascending: boolean }] | undefined;
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
      return {
        select: () => ({
          in: (_column: string, ids: string[]) => {
            capturedIds = ids;
            return {
              order: (column: string, opts: { ascending: boolean }) => {
                capturedOrder = [column, opts];
                return Promise.resolve(
                  config.txResult ?? { data: [], error: null },
                );
              },
            };
          },
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    provider,
    orderArgs: () => capturedOrder,
    transactionLineIds: () => capturedIds,
  };
}

const linkedLineRow = {
  id: 'line-1',
  amount: 'enc:500',
  kind: 'saving' as const,
  checked_at: '2026-06-01T00:00:00Z',
  monthly_budget: { month: 6, year: 2026 },
};

describe('SupabaseSavingsGoalRepository', () => {
  it('findAll scopes the query to the authenticated user (optimizer hint)', async () => {
    let capturedEq: [string, string] | undefined;
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: (column: string, value: string) => {
          capturedEq = [column, value];
          return {
            order: jest
              .fn()
              .mockResolvedValue({ data: [mockRow], error: null }),
          };
        },
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findAll();

    expect(capturedEq).toEqual(['user_id', 'user-1']);
    expect(result).toHaveLength(1);
  });

  it('findById decrypts target_amount (dedicated field, not generic)', async () => {
    const { provider } = createFindByIdProvider({
      data: mockRow,
      error: null,
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findById('goal-1');

    expect(result.targetAmount).toBe(5000); // decrypted from 'enc:5000'
    expect(result.originalTargetAmount).toBeNull();
    expect(result.status).toBe('ACTIVE');
    expect(result.initialAmount).toBeNull();
  });

  it('findById preserves an absent target as null instead of a fictitious zero', async () => {
    const { provider } = createFindByIdProvider({
      data: {
        ...mockRow,
        start_date: '2026-08-01',
        target_amount: null,
        target_date: null,
      },
      error: null,
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findById('goal-1');

    expect(result.startDate).toBe('2026-08-01');
    expect(result.targetAmount).toBeNull();
    expect(result.targetDate).toBeNull();
  });

  it('findById decrypts initial_amount (PUL-293)', async () => {
    const { provider } = createFindByIdProvider({
      data: { ...mockRow, initial_amount: 'enc:2000' },
      error: null,
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findById('goal-1');

    expect(result.initialAmount).toBe(2000); // decrypted from 'enc:2000'
  });

  it('findById scopes the query to the authenticated user (optimizer hint)', async () => {
    const { provider, eq } = createFindByIdProvider({
      data: mockRow,
      error: null,
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await repo.findById('goal-1');

    expect(eq.mock.calls).toEqual([
      ['id', 'goal-1'],
      ['user_id', 'user-1'],
    ]);
  });

  it('findById maps a zero-rows PGRST116 to SAVINGS_GOAL_NOT_FOUND (RLS-hidden)', async () => {
    const { provider } = createFindByIdProvider({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    let caught: unknown;
    try {
      await repo.findById('missing');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
    );
  });

  it('findById maps an infra failure to SAVINGS_GOAL_FETCH_FAILED, never a lying 404', async () => {
    const dbError = { code: '57014', message: 'canceling statement' };
    const { provider } = createFindByIdProvider({
      data: null,
      error: dbError,
    });
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    let caught: unknown;
    try {
      await repo.findById('goal-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED.code,
    );
    expect((caught as BusinessException).cause).toBe(dbError);
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
      startDate: null,
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

  it('insert keeps an omitted interval as SQL null without encrypting zero', async () => {
    let captured: Record<string, unknown> | undefined;
    const encryption = createMockEncryption();
    const provider = createMockProvider(() => ({
      insert: (row: Record<string, unknown>) => {
        captured = row;
        return {
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: {
                ...mockRow,
                start_date: null,
                target_amount: null,
                target_date: null,
              },
              error: null,
            }),
          }),
        };
      },
    }));
    const repo = new SupabaseSavingsGoalRepository(provider, encryption);

    await repo.insert({
      name: 'Matelas',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      status: 'ACTIVE',
    });

    expect(captured).toMatchObject({
      start_date: null,
      target_amount: null,
      target_date: null,
    });
    expect(encryption.encryptAmount).not.toHaveBeenCalled();
  });

  it('insert encrypts initialAmount, the row never carries the plaintext (PUL-293)', async () => {
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
      startDate: null,
      targetAmount: 5000,
      targetDate: '2099-01-01',
      status: 'ACTIVE',
      initialAmount: 2000,
    });

    expect(captured?.initial_amount).toBe('enc:2000');
    expect(captured?.initial_amount).not.toBe(2000);
  });

  it('insert with no initialAmount sends a null column', async () => {
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
      startDate: null,
      targetAmount: 5000,
      targetDate: '2099-01-01',
      status: 'ACTIVE',
    });

    expect(captured?.initial_amount).toBeNull();
  });

  it('update encrypts a defined initialAmount, including 0 (PATCH 0 erases the stock)', async () => {
    let captured: Record<string, unknown> | undefined;
    const provider = createMockProvider(() => ({
      update: (row: Record<string, unknown>) => {
        captured = row;
        return {
          eq: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        };
      },
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await repo.update('goal-1', { initialAmount: 0 });

    expect(captured?.initial_amount).toBe('enc:0');
  });

  it('update with initialAmount omitted never touches the initial_amount column', async () => {
    let captured: Record<string, unknown> | undefined;
    const provider = createMockProvider(() => ({
      update: (row: Record<string, unknown>) => {
        captured = row;
        return {
          eq: () => ({
            select: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        };
      },
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await repo.update('goal-1', { name: 'Maison 2' });

    expect('initial_amount' in (captured ?? {})).toBe(false);
  });

  it('validates the vault before replacing or clearing the encrypted target', async () => {
    const captured: Record<string, unknown>[] = [];
    const provider = createMockProvider(() => ({
      update: (row: Record<string, unknown>) => {
        captured.push(row);
        return {
          eq: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockRow, target_amount: row.target_amount },
                error: null,
              }),
            }),
          }),
        };
      },
    }));
    const encryption = createMockEncryption();
    const repo = new SupabaseSavingsGoalRepository(provider, encryption);

    await repo.update('goal-1', { targetAmount: null });
    await repo.update('goal-1', { targetAmount: 6000 });

    expect(captured[0]).toMatchObject({
      target_amount: null,
      original_target_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
    });
    expect(captured[1]?.target_amount).toBe('enc:6000');
    expect(encryption.ensureUserDEK).toHaveBeenCalledWith(
      mockUser.id,
      mockUser.clientKey,
    );
    expect(encryption.ensureUserDEK).toHaveBeenCalledTimes(2);
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

  it('update maps a hidden or missing row (PGRST116) to SAVINGS_GOAL_NOT_FOUND', async () => {
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'no rows' },
            }),
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

  describe('findLinkedSavingLines', () => {
    it('decrypts linked lines without querying or decrypting transactions', async () => {
      const { provider, transactionQueried } = createContributionsProvider({
        lineResult: {
          data: [{ ...linkedLineRow, is_manually_adjusted: false }],
          error: null,
        },
      });
      const encryption = createMockEncryption();
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);

      const result = await repo.findLinkedSavingLines('goal-1');

      expect(result).toEqual([
        {
          id: 'line-1',
          amount: 500,
          kind: 'saving',
          checkedAt: '2026-06-01T00:00:00Z',
          isManuallyAdjusted: false,
          month: 6,
          year: 2026,
        },
      ]);
      expect(transactionQueried()).toBe(false);
      expect(encryption.tryDecryptAmount).toHaveBeenCalledTimes(1);
      expect(encryption.tryDecryptAmount).toHaveBeenCalledWith(
        'enc:500',
        Buffer.from('dek'),
        0,
      );
    });
  });

  describe('findContributions', () => {
    // line-1 is a checked June prévision with no transaction; line-2 is an
    // unchecked March prévision carrying two réels.
    const checkedLineRow = {
      id: 'line-1',
      name: 'Épargne juin',
      amount: 'enc:500',
      checked_at: '2026-06-01T00:00:00Z',
      monthly_budget: { month: 6, year: 2026 },
    };
    const uncheckedLineRow = {
      id: 'line-2',
      name: 'Épargne mars',
      amount: 'enc:300',
      checked_at: null,
      monthly_budget: { month: 3, year: 2026 },
    };
    const makeTxRow = (over: Record<string, unknown>) => ({
      id: 'tx',
      budget_id: 'budget-1',
      budget_line_id: 'line-2',
      name: 'Virement',
      amount: 'enc:0',
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
      kind: 'saving' as const,
      transaction_tag: [{ tag_id: 'tag-1' }],
      transaction_date: '2026-03-01',
      checked_at: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
      ...over,
    });

    it('groups transactions under each line, ordered chronologically with newest réels first', async () => {
      // DB returns transactions transaction_date desc: the 20th before the 10th.
      const { provider, orderArgs } = createGoalContributionsProvider({
        lineResult: {
          data: [checkedLineRow, uncheckedLineRow],
          error: null,
        },
        txResult: {
          data: [
            makeTxRow({
              id: 'tx-late',
              amount: 'enc:200',
              transaction_date: '2026-03-20',
            }),
            makeTxRow({
              id: 'tx-early',
              amount: 'enc:100',
              transaction_date: '2026-03-10',
            }),
          ],
          error: null,
        },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findContributions('goal-1');

      // Lines ordered ascending by (year, month): March (line-2) before June (line-1).
      expect(result.map((c) => c.lineId)).toEqual(['line-2', 'line-1']);

      const march = result[0];
      expect(march).toMatchObject({
        lineId: 'line-2',
        name: 'Épargne mars',
        amount: 300, // decrypted from 'enc:300'
        checkedAt: null,
        budgetMonth: 3,
        budgetYear: 2026,
      });
      // Nested réels stay transaction_date desc and are decrypted.
      expect(march.transactions.map((t) => t.id)).toEqual([
        'tx-late',
        'tx-early',
      ]);
      expect(march.transactions.map((t) => t.amount)).toEqual([200, 100]);
      expect(march.transactions.map((t) => t.tagIds)).toEqual([
        ['tag-1'],
        ['tag-1'],
      ]);

      const june = result[1];
      expect(june).toMatchObject({
        lineId: 'line-1',
        name: 'Épargne juin',
        amount: 500,
        checkedAt: '2026-06-01T00:00:00Z',
        budgetMonth: 6,
        budgetYear: 2026,
      });
      // A checked prévision with no réel is still a contribution — empty list.
      expect(june.transactions).toEqual([]);

      expect(orderArgs()).toEqual(['transaction_date', { ascending: false }]);
    });

    it('returns [] WITHOUT a transaction query when no saving line is linked', async () => {
      const { provider, transactionLineIds } = createGoalContributionsProvider({
        lineResult: { data: [], error: null },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findContributions('goal-1');

      expect(result).toEqual([]);
      expect(transactionLineIds()).toBeUndefined(); // no ids → skip the round-trip
    });

    it('wraps a transaction-query error in TRANSACTION_FETCH_FAILED', async () => {
      const dbError = { message: 'statement timeout' };
      const { provider } = createGoalContributionsProvider({
        lineResult: { data: [checkedLineRow], error: null },
        txResult: { data: null, error: dbError },
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findContributions('goal-1');
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

  describe('findMaterializedPeriods', () => {
    it('returns every budget period scoped to the authenticated user', async () => {
      let capturedEq: [string, string] | undefined;
      const provider = createMockProvider((table) => {
        expect(table).toBe('monthly_budget');
        return {
          select: (columns: string) => {
            expect(columns).toBe('month, year');
            return {
              eq: (column: string, value: string) => {
                capturedEq = [column, value];
                return Promise.resolve({
                  data: [
                    { month: 7, year: 2026 },
                    { month: 8, year: 2026 },
                  ],
                  error: null,
                });
              },
            };
          },
        };
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      await expect(repo.findMaterializedPeriods()).resolves.toEqual([
        { month: 7, year: 2026 },
        { month: 8, year: 2026 },
      ]);
      expect(capturedEq).toEqual(['user_id', mockUser.id]);
    });

    it('wraps fetch failures with user context and the original cause', async () => {
      const dbError = { message: 'budget periods unavailable' };
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: dbError }),
        }),
      }));
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findMaterializedPeriods();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).cause).toBe(dbError);
      expect((caught as BusinessException).loggingContext).toEqual({
        operation: 'findSavingsGoalMaterializedPeriods',
        entityType: 'monthly_budget',
        userId: mockUser.id,
      });
    });
  });

  describe('applyPlan', () => {
    it('sends only encrypted concrete-line updates to the hardened RPC', async () => {
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const encryption = createMockEncryption();
      encryption.prepareAmountData = jest
        .fn()
        .mockResolvedValue({ amount: 'enc:123' });
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);
      const lineId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        repo.applyPlan(
          '123e4567-e89b-12d3-a456-426614174001',
          [{ budgetLineId: lineId, amount: 123 }],
          24_319,
        ),
      ).resolves.toEqual({
        updatedLines: [],
        touchedBudgetIds: [],
      });
      expect(rpc).toHaveBeenCalledWith('apply_savings_goal_plan', {
        p_goal_id: '123e4567-e89b-12d3-a456-426614174001',
        p_min_period_index: 24_319,
        p_line_updates: [{ budget_line_id: lineId, amount: 'enc:123' }],
      });
    });
  });

  describe('reconcileTargetDate (PUL-313)', () => {
    const goalId = '123e4567-e89b-12d3-a456-426614174001';
    const lineId = '123e4567-e89b-12d3-a456-426614174002';
    const budgetId = '123e4567-e89b-12d3-a456-426614174003';

    it('encrypts the financial patch and sends one atomic RPC command', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          goal: {
            ...mockRow,
            id: goalId,
            user_id: '123e4567-e89b-12d3-a456-426614174004',
            name: 'Maison proche',
            target_amount: 'enc:4000',
            target_date: '2030-03-15',
            initial_amount: 'enc:250',
          },
          affected_line_ids: [lineId],
          touched_budget_ids: [budgetId],
        },
        error: null,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const encryption = createMockEncryption();
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);

      const result = await repo.reconcileTargetDate(goalId, {
        patch: {
          name: 'Maison proche',
          targetAmount: 4000,
          targetDate: '2030-03-15',
          initialAmount: 250,
        },
        reconciliation: { mode: 'freeze', budgetLineIds: [lineId] },
        expectedTargetDate: '2030-05-15',
      });

      expect(rpc).toHaveBeenCalledWith('reconcile_savings_goal_target_date', {
        p_goal_id: goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [lineId],
        p_expected_target_date: '2030-05-15',
        p_patch: {
          name: 'Maison proche',
          target_amount: 'enc:4000',
          target_date: '2030-03-15',
          initial_amount: 'enc:250',
        },
      });
      expect(result).toMatchObject({
        goal: {
          id: goalId,
          name: 'Maison proche',
          targetAmount: 4000,
          targetDate: '2030-03-15',
          initialAmount: 250,
        },
        affectedLineIds: [lineId],
        touchedBudgetIds: [budgetId],
      });
      expect(encryption.encryptAmount).toHaveBeenCalledWith(
        4000,
        expect.any(Buffer),
      );
    });

    it('maps candidate-set drift to reconciliation conflict', async () => {
      const dbError = {
        code: 'P0001',
        message: 'Savings goal reconciliation conflict',
      };
      const rpc = jest.fn().mockResolvedValue({ data: null, error: dbError });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      await expect(
        repo.reconcileTargetDate(goalId, {
          patch: { targetDate: '2030-03-15' },
          reconciliation: { mode: 'remove', budgetLineIds: [lineId] },
          expectedTargetDate: '2030-05-15',
        }),
      ).rejects.toMatchObject({
        code: 'ERR_SAVINGS_GOAL_RECONCILIATION_CONFLICT',
      });
    });

    it('keeps an unexpected database error only in the cause chain', async () => {
      const dbError = { code: 'XX000', message: 'database unavailable' };
      const rpc = jest.fn().mockResolvedValue({ data: null, error: dbError });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.reconcileTargetDate(goalId, {
          patch: { targetDate: '2030-03-15' },
          reconciliation: { mode: 'remove', budgetLineIds: [lineId] },
          expectedTargetDate: '2030-05-15',
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).cause).toBe(dbError);
      expect((caught as BusinessException).loggingContext).toEqual({
        operation: 'reconcileSavingsGoalTargetDate',
        entityType: 'savings_goal',
      });
    });
  });

  describe('PUL-319 deletion impact', () => {
    const goalId = '123e4567-e89b-42d3-a456-426614174001';
    const budgetId = '123e4567-e89b-42d3-a456-426614174002';
    const lineId = '123e4567-e89b-42d3-a456-426614174003';
    const transactionId = '123e4567-e89b-42d3-a456-426614174004';
    const now = '2026-07-27T10:00:00+00:00';
    const revision = {
      templateLines: [],
      budgetLines: [{ id: lineId, updatedAt: now }],
      transactions: [{ id: transactionId, updatedAt: now }],
    };

    it('decrypts the complete preview and computes its totals', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          goalId,
          templateLines: [],
          budgets: [
            {
              budgetId,
              month: 7,
              year: 2026,
              lines: [
                {
                  lineId,
                  name: 'Épargne',
                  amount: 'enc:500',
                  recurrence: 'fixed',
                  checkedAt: null,
                  updatedAt: now,
                  transactions: [
                    {
                      id: transactionId,
                      budgetId,
                      budgetLineId: lineId,
                      name: 'Virement',
                      amount: 'enc:200',
                      kind: 'saving',
                      transactionDate: now,
                      checkedAt: null,
                      createdAt: now,
                      updatedAt: now,
                      originalAmount: null,
                      originalCurrency: null,
                      targetCurrency: null,
                      exchangeRate: null,
                    },
                  ],
                },
              ],
            },
          ],
          revision,
        },
        error: null,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const impact = await repo.getDeletionImpact(goalId);

      expect(impact.summary).toEqual({
        templateLineCount: 0,
        templateLineTotal: 0,
        budgetCount: 1,
        budgetLineCount: 1,
        budgetLineTotal: 500,
        transactionCount: 1,
        transactionTotal: 200,
        withdrawalCount: 0,
        withdrawalTotal: 0,
      });
      expect(impact.budgets[0].lines[0].transactions[0].amount).toBe(200);
      expect(impact.revision).toEqual(revision);
    });

    it('maps a foreign preview to SAVINGS_GOAL_NOT_FOUND', async () => {
      const dbError = {
        code: 'P0001',
        message: 'Savings goal access denied',
      };
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const caught = await repo
        .getDeletionImpact(goalId)
        .catch((error) => error);

      expect(caught).toBeInstanceOf(BusinessException);
      expect(caught).toMatchObject({
        code: ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
        cause: dbError,
        loggingContext: {
          operation: 'getSavingsGoalDeletionImpact',
          entityId: goalId,
          entityType: 'savings_goal',
          userId: mockUser.id,
        },
      });
    });

    it('sends the exact mode and revision and deduplicates touched budgets', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: [{ budget_id: budgetId }, { budget_id: budgetId }],
        error: null,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      await expect(
        repo.applyDeletion(goalId, {
          mode: 'goal_and_forecasts',
          revision,
        }),
      ).resolves.toEqual({ touchedBudgetIds: [budgetId] });
      expect(rpc).toHaveBeenCalledWith('apply_savings_goal_deletion', {
        p_goal_id: goalId,
        p_mode: 'goal_and_forecasts',
        p_revision: revision,
      });
    });

    it('keeps a generic deletion RPC error only in the cause chain', async () => {
      const dbError = {
        code: 'XX000',
        message: 'Unexpected deletion failure',
      };
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const caught = await repo
        .applyDeletion(goalId, { mode: 'goal_only', revision })
        .catch((error) => error);

      expect(caught).toBeInstanceOf(BusinessException);
      expect(caught).toMatchObject({
        code: ERROR_DEFINITIONS.SAVINGS_GOAL_DELETE_FAILED.code,
        cause: dbError,
        loggingContext: {
          operation: 'applySavingsGoalDeletion',
          entityType: 'savings_goal',
          userId: mockUser.id,
        },
      });
    });

    it('maps a changed revision to a 409 concurrent modification', async () => {
      const dbError = {
        code: 'P0001',
        message: 'Savings goal deletion impact changed',
      };
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });
      const provider = {
        get client() {
          return { rpc } as unknown as AuthenticatedSupabaseClient;
        },
        get user() {
          return mockUser;
        },
      } as AuthenticatedSupabaseProvider;
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      await expect(
        repo.applyDeletion(goalId, { mode: 'goal_only', revision }),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.CONCURRENT_MODIFICATION.code,
        status: 409,
        cause: dbError,
        loggingContext: {
          operation: 'applySavingsGoalDeletion',
          entityType: 'savings_goal',
          userId: mockUser.id,
        },
      });
    });
  });
});
