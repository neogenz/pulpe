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
  balance_revision: 0,
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
  lineGoalIds: () => string[] | undefined;
} {
  let queried = false;
  let capturedIds: string[] | undefined;
  let capturedGoalIds: string[] | undefined;
  const provider = createMockProvider((table: string) => {
    if (table === 'budget_line') {
      return {
        select: () => ({
          in: (_column: string, goalIds: string[]) => {
            capturedGoalIds = goalIds;
            return { eq: () => Promise.resolve(config.lineResult) };
          },
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
    lineGoalIds: () => capturedGoalIds,
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

/**
 * Provider for the two withdrawal readers. Each table gets exactly the chain it
 * owns and nothing more: `budget_line` continues into the `.eq(...)` kind guard,
 * `transaction` ends at `.in(...)`. A kind guard drifting from the planned reader
 * onto the realized one therefore throws, where a value that was both awaitable
 * and chainable would have let it through unseen. Records the table and both
 * filters so a drift on any of the three surfaces is a unit failure instead of
 * an integration surprise.
 */
function createWithdrawalProvider(result: DbResult): {
  provider: AuthenticatedSupabaseProvider;
  table: () => string | undefined;
  inArgs: () => [string, string[]] | undefined;
  eqArgs: () => [string, string] | undefined;
} {
  let capturedTable: string | undefined;
  let capturedIn: [string, string[]] | undefined;
  let capturedEq: [string, string] | undefined;
  const provider = createMockProvider((table: string) => {
    capturedTable = table;
    return {
      select: () => ({
        in: (column: string, goalIds: string[]) => {
          capturedIn = [column, goalIds];
          if (table !== 'budget_line') return Promise.resolve(result);
          return {
            eq: (eqColumn: string, value: string) => {
              capturedEq = [eqColumn, value];
              return Promise.resolve(result);
            },
          };
        },
      }),
    };
  });
  return {
    provider,
    table: () => capturedTable,
    inArgs: () => capturedIn,
    eqArgs: () => capturedEq,
  };
}

const withdrawalRow = {
  id: 'tx-1',
  budget_id: 'budget-1',
  budget_line_id: 'line-9',
  source_savings_goal_id: 'goal-1',
  name: 'Retrait acompte',
  amount: 'enc:800',
  transaction_date: '2026-06-15',
  checked_at: '2026-06-15T10:00:00Z',
  monthly_budget: { month: 6, year: 2026 },
};

const plannedWithdrawalRow = {
  id: 'line-7',
  budget_id: 'budget-1',
  source_savings_goal_id: 'goal-1',
  name: 'Retrait planifié',
  amount: 'enc:1200',
  monthly_budget: { month: 9, year: 2026 },
};

const linkedLineRow = {
  id: 'line-1',
  savings_goal_id: 'goal-1',
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
      const { provider, lineGoalIds } = createContributionsProvider({
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

      // Le lot partagé avec la lecture groupée ne doit pas élargir la portée :
      // un seul objectif reste un seul objectif.
      expect(lineGoalIds()).toEqual(['goal-1']);
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

  describe('findPlannedWithdrawals', () => {
    it('reads budget_line filtered on the goal AND on kind=income, flattening the budget period', async () => {
      const { provider, table, inArgs, eqArgs } = createWithdrawalProvider({
        data: [plannedWithdrawalRow],
        error: null,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findPlannedWithdrawals('goal-1');

      // Le jumeau de `fetchLinkedLineRows`, de l'autre côté du pot : même forme
      // de requête, autre colonne source et le kind inverse.
      expect(table()).toBe('budget_line');
      expect(inArgs()).toEqual(['source_savings_goal_id', ['goal-1']]);
      expect(eqArgs()).toEqual(['kind', 'income']);
      expect(result).toEqual([
        { id: 'line-7', amount: 1200, month: 9, year: 2026 },
      ]);
    });

    it('returns empty WITHOUT asking for the DEK when no forecast announces a withdrawal', async () => {
      const { provider } = createWithdrawalProvider({ data: [], error: null });
      const encryption = createMockEncryption();
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);

      const result = await repo.findPlannedWithdrawals('goal-1');

      expect(result).toEqual([]);
      expect(encryption.getDekFor).not.toHaveBeenCalled();
    });

    it('wraps a database error in SAVINGS_GOAL_FETCH_FAILED, original kept in the cause chain', async () => {
      const dbError = { message: 'permission denied' };
      const { provider } = createWithdrawalProvider({
        data: null,
        error: dbError,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findPlannedWithdrawals('goal-1');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED.code,
      );
      expect((caught as BusinessException).cause).toBe(dbError);
    });
  });

  describe('findPlannedWithdrawalRecords', () => {
    it('returns the presentable forecast with its budget and decrypted amount', async () => {
      const { provider } = createWithdrawalProvider({
        data: [plannedWithdrawalRow],
        error: null,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findPlannedWithdrawalRecords('goal-1');

      expect(result).toEqual([
        {
          budgetLineId: 'line-7',
          budgetId: 'budget-1',
          name: 'Retrait planifié',
          amount: 1200,
          month: 9,
          year: 2026,
        },
      ]);
    });
  });

  describe('findPlanWithdrawals', () => {
    it('loads the owner-scoped encrypted withdrawal and marks its plan origin', async () => {
      const eqCalls: [string, string][] = [];
      const query = {
        eq: jest.fn((column: string, value: string) => {
          eqCalls.push([column, value]);
          return eqCalls.length === 1
            ? query
            : Promise.resolve({
                data: [
                  {
                    id: 'withdrawal-1',
                    amount: 'enc:4500',
                    month: 9,
                    year: 2026,
                  },
                ],
                error: null,
              });
        }),
      };
      let capturedTable: string | undefined;
      const provider = createMockProvider((table) => {
        capturedTable = table;
        return { select: () => query };
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findPlanWithdrawals('goal-1');

      expect(capturedTable).toBe('savings_goal_plan_withdrawal');
      expect(eqCalls).toEqual([
        ['savings_goal_id', 'goal-1'],
        ['user_id', 'user-1'],
      ]);
      expect(result).toEqual([
        {
          id: 'withdrawal-1',
          amount: 4500,
          month: 9,
          year: 2026,
          origin: 'plan',
        },
      ]);
    });

    it('returns empty without loading the DEK', async () => {
      const query = {
        eq: jest.fn(),
      };
      query.eq
        .mockReturnValueOnce(query)
        .mockResolvedValueOnce({ data: [], error: null });
      const encryption = createMockEncryption();
      const repo = new SupabaseSavingsGoalRepository(
        createMockProvider(() => ({ select: () => query })),
        encryption,
      );

      await expect(repo.findPlanWithdrawals('goal-1')).resolves.toEqual([]);
      expect(encryption.getDekFor).not.toHaveBeenCalled();
    });
  });

  describe('findLinkedWithdrawals', () => {
    it('reads transaction, not budget_line, and renames budget_line_id→budgetLineId', async () => {
      const { provider, table, inArgs } = createWithdrawalProvider({
        data: [withdrawalRow],
        error: null,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findLinkedWithdrawals('goal-1');

      expect(table()).toBe('transaction');
      expect(inArgs()).toEqual(['source_savings_goal_id', ['goal-1']]);
      expect(result).toEqual([
        { amount: 800, month: 6, year: 2026, budgetLineId: 'line-9' },
      ]);
    });

    it('wraps a database error in TRANSACTION_FETCH_FAILED, not in its planned twin definition', async () => {
      const dbError = { message: 'statement timeout' };
      const { provider } = createWithdrawalProvider({
        data: null,
        error: dbError,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      let caught: unknown;
      try {
        await repo.findLinkedWithdrawals('goal-1');
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

  describe('findWithdrawals', () => {
    it('maps the record shape and orders by transaction date, most recent first', async () => {
      const { provider } = createWithdrawalProvider({
        // Délibérément en désordre : le tri appartient au repository, pas à la base.
        data: [
          { ...withdrawalRow, id: 'tx-old', transaction_date: '2026-06-02' },
          { ...withdrawalRow, id: 'tx-new', transaction_date: '2026-06-28' },
          { ...withdrawalRow, id: 'tx-mid', transaction_date: '2026-06-15' },
        ],
        error: null,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findWithdrawals('goal-1');

      expect(result).toEqual([
        {
          transactionId: 'tx-new',
          budgetId: 'budget-1',
          budgetLineId: 'line-9',
          name: 'Retrait acompte',
          transactionDate: '2026-06-28',
          amount: 800,
          checkedAt: '2026-06-15T10:00:00Z',
        },
        {
          transactionId: 'tx-mid',
          budgetId: 'budget-1',
          budgetLineId: 'line-9',
          name: 'Retrait acompte',
          transactionDate: '2026-06-15',
          amount: 800,
          checkedAt: '2026-06-15T10:00:00Z',
        },
        {
          transactionId: 'tx-old',
          budgetId: 'budget-1',
          budgetLineId: 'line-9',
          name: 'Retrait acompte',
          transactionDate: '2026-06-02',
          amount: 800,
          checkedAt: '2026-06-15T10:00:00Z',
        },
      ]);
    });

    it('passes 0 as the decryption fallback for an unreadable amount', async () => {
      const { provider } = createWithdrawalProvider({
        data: [{ ...withdrawalRow, amount: 'unreadable-ciphertext' }],
        error: null,
      });
      const repo = new SupabaseSavingsGoalRepository(
        provider,
        createMockEncryption(),
      );

      const result = await repo.findWithdrawals('goal-1');

      expect(result).toEqual([
        {
          transactionId: 'tx-1',
          budgetId: 'budget-1',
          budgetLineId: 'line-9',
          name: 'Retrait acompte',
          transactionDate: '2026-06-15',
          amount: 0,
          checkedAt: '2026-06-15T10:00:00Z',
        },
      ]);
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
    it('sends an encrypted line update and direct-withdrawal removal atomically', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          updated_lines: [],
          touched_budget_ids: ['123e4567-e89b-12d3-a456-426614174099'],
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
          [{ month: 9, year: 2026, amount: 0 }],
          11,
        ),
      ).resolves.toEqual({
        updatedLines: [],
        touchedBudgetIds: ['123e4567-e89b-12d3-a456-426614174099'],
      });
      expect(rpc).toHaveBeenCalledWith(
        'apply_savings_goal_plan_with_destinations',
        {
          p_goal_id: '123e4567-e89b-12d3-a456-426614174001',
          p_min_period_index: 24_319,
          p_line_updates: [{ budget_line_id: lineId, amount: 'enc:123' }],
          p_plan_withdrawals: [
            {
              month: 9,
              year: 2026,
              amount: null,
              destination: 'goal_only',
            },
          ],
          p_expected_revision: 11,
        },
      );
    });

    it('encrypts plan-only withdrawals as positive stock movements and sends zero as deletion', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: { updated_lines: [], touched_budget_ids: [] },
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
      encryption.prepareAmountData = jest
        .fn()
        .mockImplementation((amount: number) =>
          Promise.resolve({ amount: `enc:${amount}` }),
        );
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);

      const result = await repo.applyPlan(
        '123e4567-e89b-12d3-a456-426614174001',
        [],
        24_319,
        [
          { month: 9, year: 2026, amount: -4_500 },
          { month: 10, year: 2026, amount: 0 },
        ],
        11,
      );

      expect(encryption.prepareAmountData).toHaveBeenCalledWith(
        4_500,
        mockUser.id,
        mockUser.clientKey,
      );
      expect(result).toEqual({
        updatedLines: [],
        touchedBudgetIds: [],
      });
      expect(rpc).toHaveBeenCalledWith(
        'apply_savings_goal_plan_with_destinations',
        {
          p_goal_id: '123e4567-e89b-12d3-a456-426614174001',
          p_min_period_index: 24_319,
          p_line_updates: [],
          p_plan_withdrawals: [
            {
              month: 9,
              year: 2026,
              amount: 'enc:4500',
              destination: 'goal_only',
            },
            {
              month: 10,
              year: 2026,
              amount: null,
              destination: 'goal_only',
            },
          ],
          p_expected_revision: 11,
        },
      );
    });

    it('sends a plan-managed linked income through the atomic destination RPC', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          updated_lines: [],
          touched_budget_ids: ['123e4567-e89b-12d3-a456-426614174099'],
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
      encryption.prepareAmountData = jest
        .fn()
        .mockResolvedValue({ amount: 'enc:4500' });
      const repo = new SupabaseSavingsGoalRepository(provider, encryption);

      const result = await repo.applyPlan(
        '123e4567-e89b-12d3-a456-426614174001',
        [],
        24_319,
        [
          {
            month: 9,
            year: 2026,
            amount: -4_500,
            destination: 'linked_income',
          },
        ],
        11,
      );

      expect(result).toEqual({
        updatedLines: [],
        touchedBudgetIds: ['123e4567-e89b-12d3-a456-426614174099'],
      });

      expect(rpc).toHaveBeenCalledWith(
        'apply_savings_goal_plan_with_destinations',
        expect.objectContaining({
          p_expected_revision: 11,
          p_plan_withdrawals: [
            {
              month: 9,
              year: 2026,
              amount: 'enc:4500',
              destination: 'linked_income',
            },
          ],
        }),
      );
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
    const withdrawalId = '123e4567-e89b-42d3-a456-426614174005';
    const unreadableWithdrawalId = '123e4567-e89b-42d3-a456-426614174006';
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
          withdrawals: [
            {
              transactionId: withdrawalId,
              budgetId,
              name: 'Retrait Voyage',
              transactionDate: now,
              amount: 'enc:300',
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
        withdrawalCount: 1,
        withdrawalTotal: 300,
      });
      expect(impact.budgets[0].lines[0].transactions[0].amount).toBe(200);
      expect(impact.withdrawals).toEqual([
        {
          transactionId: withdrawalId,
          budgetId,
          name: 'Retrait Voyage',
          transactionDate: now,
          amount: 300,
        },
      ]);
      expect(impact.revision).toEqual(revision);
    });

    it('keeps the preview readable when one withdrawal amount cannot be decrypted', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          goalId,
          templateLines: [],
          budgets: [],
          withdrawals: [
            {
              transactionId: withdrawalId,
              budgetId,
              name: 'Retrait Voyage',
              transactionDate: now,
              amount: 'enc:300',
            },
            {
              transactionId: unreadableWithdrawalId,
              budgetId,
              name: 'Retrait illisible',
              transactionDate: now,
              amount: null,
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

      expect(impact.withdrawals).toHaveLength(2);
      expect(impact.withdrawals[1].amount).toBe(0);
      expect(impact.summary.withdrawalTotal).toBe(300);
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

    // PUL-329 — the SQL function grew a key the strict schema did not know and
    // the endpoint answered 500 to every caller. The missing key is added now;
    // what this pins is the landing: the NEXT drift must arrive as a named
    // business failure carrying the offending path, not as an opaque crash.
    it('lands a drifted RPC payload on a diagnosable failure', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: {
          goalId,
          templateLines: [],
          budgets: [],
          withdrawals: [],
          revision,
          unexpectedKey: 'a field the SQL function grew',
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

      const caught = await repo
        .getDeletionImpact(goalId)
        .catch((error) => error);

      expect(caught).toBeInstanceOf(BusinessException);
      expect(caught.code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED.code,
      );
      expect(JSON.stringify(caught.loggingContext.validationErrors)).toContain(
        'unexpectedKey',
      );
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

  // The goal RPCs lock the goal first, ordinary line and transaction writes
  // reach it last through the balance-revision triggers: the two orders can
  // meet and PostgreSQL rolls one side back whole (PUL-329 review). Nothing
  // was written, so the client must be told to replay, not that we failed.
  describe('PUL-329 lock arbitration', () => {
    const goalId = '123e4567-e89b-42d3-a456-426614174001';
    const lineId = '123e4567-e89b-42d3-a456-426614174002';

    const buildRepo = (dbError: { code: string; message: string }) => {
      const rpc = jest.fn().mockResolvedValue({ data: null, error: dbError });
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
      return new SupabaseSavingsGoalRepository(provider, encryption);
    };

    const callers: [
      string,
      string,
      (repo: SupabaseSavingsGoalRepository) => Promise<unknown>,
    ][] = [
      [
        'applyDeletion',
        'applySavingsGoalDeletion',
        (repo) =>
          repo.applyDeletion(goalId, {
            mode: 'goal_only',
            revision: {
              templateLines: [],
              budgetLines: [],
              transactions: [],
            },
          }),
      ],
      [
        'applyPlan',
        'applySavingsGoalPlan',
        (repo) =>
          repo.applyPlan(
            goalId,
            [{ budgetLineId: lineId, amount: 123 }],
            0,
            [],
            7,
          ),
      ],
      [
        'applyGenerationStop',
        'applySavingsGoalGenerationStop',
        (repo) => repo.applyGenerationStop(goalId, 'freeze', [lineId], 0),
      ],
      [
        'reconcileTargetDate',
        'reconcileSavingsGoalTargetDate',
        (repo) =>
          repo.reconcileTargetDate(goalId, {
            patch: { targetDate: '2030-03-15' },
            reconciliation: { mode: 'freeze', budgetLineIds: [lineId] },
            expectedTargetDate: '2030-05-15',
          }),
      ],
    ];

    it.each(callers)(
      '%s maps an arbitrated deadlock to a 409 the client replays',
      async (_name, operation, call) => {
        const dbError = { code: '40P01', message: 'deadlock detected' };

        await expect(call(buildRepo(dbError))).rejects.toMatchObject({
          code: ERROR_DEFINITIONS.CONCURRENT_MODIFICATION.code,
          status: 409,
          cause: dbError,
          loggingContext: { operation, entityType: 'savings_goal' },
        });
      },
    );

    it('leaves an ownership rejection on its own error', async () => {
      const dbError = {
        code: 'P0001',
        message: 'Savings goal access denied',
      };

      await expect(
        buildRepo(dbError).applyGenerationStop(goalId, 'freeze', [lineId], 0),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
      });
    });
  });
});
