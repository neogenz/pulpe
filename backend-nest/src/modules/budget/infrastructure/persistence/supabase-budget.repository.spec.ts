import { afterAll, beforeAll, describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetRepository } from './supabase-budget.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetLineRow, TransactionRow } from '../../domain/budget.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { MaterializedBudgetPeriod } from '../../domain/ports/savings-goal-horizon.port';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const budgetRow = {
  id: 'budget-1',
  user_id: 'user-1',
  template_id: 'template-1',
  month: 1,
  year: 2026,
  description: 'Janvier',
  ending_balance: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const budgetLineRow: BudgetLineRow = {
  id: 'line-1',
  budget_id: 'budget-1',
  template_line_id: null,
  savings_goal_id: null,
  spread_group_id: null,
  savings_withdrawal_group_id: null,
  source_savings_goal_id: null,
  source_savings_goal_name: null,
  name: 'Prime assurance',
  amount: 'encrypted-100',
  kind: 'expense',
  recurrence: 'one_off',
  is_manually_adjusted: false,
  is_savings_goal_plan_adjustment: false,
  checked_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  original_amount: null,
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
    getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
    decryptRowAmountFields: jest.fn().mockImplementation((row) => ({
      ...row,
      amount: 100,
      original_amount: null,
    })),
    tryDecryptAmount: jest.fn().mockReturnValue(0),
  } as unknown as EncryptionPort;
}

const budgetLineOrderSpy = jest.fn();

/**
 * Supabase's query builder is a thenable that keeps accepting `.order()`, so a
 * mock that resolves on the first call cannot see a second sort key.
 */
function budgetLineQuery(lineRow: BudgetLineRow) {
  const result = Promise.resolve({ data: [lineRow], error: null });
  const chain = {
    order: budgetLineOrderSpy,
    then: result.then.bind(result),
  };
  budgetLineOrderSpy.mockReturnValue(chain);
  return chain;
}

function emptyBudgetLineQuery() {
  const result = Promise.resolve({ data: [], error: null });
  const chain = { order: jest.fn(), then: result.then.bind(result) };
  chain.order.mockReturnValue(chain);
  return chain;
}

function fetchBudgetDataProvider(
  lineRow: BudgetLineRow,
): AuthenticatedSupabaseProvider {
  // Le spion vit au niveau module, donc son historique d'appels traverse les
  // `describe`. Le vider ici, au montage du double — une fois par test, avant
  // que quoi que ce soit ne s'exécute — plutôt que dans le test qui l'interroge :
  // autrement, un test ajouté sans ce nettoyage lirait les appels du précédent
  // et passerait sans rien prouver.
  budgetLineOrderSpy.mockClear();
  return createMockProvider((table: string) => {
    if (table === 'monthly_budget') {
      return {
        select: () => ({
          eq: () => ({
            single: jest
              .fn()
              .mockResolvedValue({ data: budgetRow, error: null }),
          }),
        }),
      };
    }
    if (table === 'budget_line') {
      return {
        select: () => ({
          eq: () => budgetLineQuery(lineRow),
        }),
      };
    }
    // transaction
    return {
      select: () => ({
        eq: () => ({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
  });
}

/**
 * `.from('monthly_budget').select().eq().eq().single()` — the fetchBudgetById
 * chain — resolving to a configurable single result.
 */
function fetchByIdProvider(result: {
  data: unknown;
  error: unknown;
}): AuthenticatedSupabaseProvider {
  return createMockProvider((table: string) => {
    if (table !== 'monthly_budget') {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue(result),
          }),
        }),
      }),
    };
  });
}

describe('SupabaseBudgetRepository fetchBudgetById error mapping', () => {
  // Bug repro (2026-07): a saturated local PostgREST cancels the .single()
  // query with a statement-timeout; the old `if (error || !data)` mapped it to
  // BUDGET_NOT_FOUND → the user got a lying 404 for a budget that exists.
  it('maps a statement-timeout (infra failure) to BUDGET_FETCH_FAILED, not a lying 404', async () => {
    const dbError = {
      code: '57014',
      message: 'canceling statement due to statement timeout',
    };
    const provider = fetchByIdProvider({ data: null, error: dbError });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    let caught: unknown;
    try {
      await repo.fetchBudgetById('budget-1', 'user-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.BUDGET_FETCH_FAILED.code,
    );
    expect((caught as BusinessException).getStatus()).toBe(500);
    expect((caught as BusinessException).cause).toBe(dbError);
  });

  it('maps PGRST116 (zero rows for .single()) to BUDGET_NOT_FOUND', async () => {
    const provider = fetchByIdProvider({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    let caught: unknown;
    try {
      await repo.fetchBudgetById('budget-1', 'user-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND.code,
    );
    expect((caught as BusinessException).getStatus()).toBe(404);
  });
});

describe('SupabaseBudgetRepository fetchBudgetDataForRecalc (strict decrypt)', () => {
  // The genuine cross-DEK GCM failure is proven in
  // encryption/infrastructure/crypto/cross-dek-budget-line.spec.ts; here the
  // port stub reproduces its observable contract: decryptAmount throws.
  const FOREIGN_CIPHERTEXT = 'ciphertext-under-another-dek';
  const OWNED_CIPHERTEXT = 'ciphertext-under-own-dek';

  function createStrictEncryption(): EncryptionPort {
    return {
      getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
      decryptAmount: jest.fn().mockImplementation((ciphertext: string) => {
        if (ciphertext === OWNED_CIPHERTEXT) return 500;
        throw new Error('Unsupported state or unable to authenticate data');
      }),
    } as unknown as EncryptionPort;
  }

  function recalcProvider(
    lineRows: unknown[],
    txRows: unknown[],
  ): AuthenticatedSupabaseProvider {
    return createMockProvider((table: string) => {
      if (table === 'budget_line') {
        return {
          select: () => ({
            eq: jest.fn().mockResolvedValue({ data: lineRows, error: null }),
          }),
        };
      }
      if (table === 'transaction') {
        return {
          select: () => ({
            eq: jest.fn().mockResolvedValue({ data: txRows, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
  }

  it('throws ENCRYPTION_DECRYPT_FAILED when a non-null amount fails decryption', async () => {
    // Arrange: one undecryptable ciphertext — the exact silent-zero scenario
    // that used to persist a wrong ending_balance.
    const provider = recalcProvider(
      [{ id: 'line-1', kind: 'expense', amount: FOREIGN_CIPHERTEXT }],
      [],
    );
    const repo = new SupabaseBudgetRepository(
      provider,
      createStrictEncryption(),
    );

    // Act
    let caught: unknown;
    try {
      await repo.fetchBudgetDataForRecalc('budget-1');
    } catch (error) {
      caught = error;
    }

    // Assert
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.ENCRYPTION_DECRYPT_FAILED.code,
    );
    expect((caught as BusinessException).getStatus()).toBe(500);
  });

  it('maps null amounts to 0 and decrypts valid ciphertexts without throwing', async () => {
    // Arrange
    const provider = recalcProvider(
      [
        { id: 'line-1', kind: 'income', amount: OWNED_CIPHERTEXT },
        { id: 'line-2', kind: 'expense', amount: null },
      ],
      [{ kind: 'expense', amount: null, budget_line_id: null }],
    );
    const repo = new SupabaseBudgetRepository(
      provider,
      createStrictEncryption(),
    );

    // Act
    const result = await repo.fetchBudgetDataForRecalc('budget-1');

    // Assert
    expect(result.budgetLines).toEqual([
      { id: 'line-1', kind: 'income', amount: 500 },
      { id: 'line-2', kind: 'expense', amount: 0 },
    ]);
    expect(result.transactions).toEqual([
      { kind: 'expense', amount: 0, budgetLineId: null },
    ]);
  });
});

describe('SupabaseBudgetRepository createBudgetFromTemplateRpc — savings goal horizon (PUL-311)', () => {
  beforeAll(() => jest.setSystemTime(new Date('2026-07-15T12:00:00Z')));
  afterAll(() => jest.useRealTimers());

  const USER_UUID = 'f1f0c5d6-9b3a-4c2e-8d7f-1a2b3c4d5e6f';
  const TEMPLATE_UUID = '2b7c1e90-5d4a-4f31-9c8b-6e5d4c3b2a19';
  const BUDGET_UUID = '9c8b7a65-4d3e-4210-8f7e-6d5c4b3a2918';
  const OVERDUE_GOAL_UUID = '11111111-2222-4333-8444-555555555555';
  const ON_TIME_GOAL_UUID = '66666666-7777-4888-8999-aaaaaaaaaaaa';

  const rpcResponse = {
    budget: {
      id: BUDGET_UUID,
      user_id: USER_UUID,
      template_id: TEMPLATE_UUID,
      month: 11,
      year: 2026,
      description: '',
      ending_balance: null,
      created_at: '2026-10-27T00:00:00Z',
      updated_at: '2026-10-27T00:00:00Z',
    },
    budget_lines_created: 1,
    template_name: 'Mois type',
  };

  /**
   * Provider exposing the two surfaces the generation path touches: the
   * savings_goal read and the RPC. `auth.getUser` is wired as a spy that must
   * stay untouched — the pay day now travels on the authenticated user.
   */
  function generationProvider(
    goals: {
      id: string;
      created_at: string;
      start_date: string | null;
      target_date: string | null;
    }[],
    payDayOfMonth: number | null,
    rpc: ReturnType<typeof jest.fn>,
    getUser: ReturnType<typeof jest.fn> = jest.fn(),
  ): AuthenticatedSupabaseProvider {
    const result = Promise.resolve({ data: goals, error: null });
    const query = {
      eq: jest.fn(),
      then: result.then.bind(result),
    };
    query.eq.mockReturnValue(query);

    const client = {
      from: (table: string) => {
        if (table !== 'savings_goal') {
          throw new Error(`unexpected table: ${table}`);
        }
        return { select: () => query };
      },
      auth: { getUser },
      rpc,
    } as unknown as AuthenticatedSupabaseClient;

    return {
      get client() {
        return client;
      },
      get user() {
        return { ...mockUser, id: USER_UUID, payDayOfMonth };
      },
    } as unknown as AuthenticatedSupabaseProvider;
  }

  const payload = {
    p_user_id: USER_UUID,
    p_template_id: TEMPLATE_UUID,
    p_month: 11,
    p_year: 2026,
    p_description: '',
  };

  it('excludes a goal whose target period precedes the budget period, payDay-aware', async () => {
    // payDay 27: 12.10.2026 belongs to period 10/2026, before the 11/2026
    // budget being materialized — the reported over-commitment scenario.
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const repo = new SupabaseBudgetRepository(
      generationProvider(
        [
          {
            id: OVERDUE_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: null,
            target_date: '2026-10-12',
          },
        ],
        27,
        rpc,
      ),
      createMockEncryption(),
    );

    await repo.createBudgetFromTemplateRpc(payload);

    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({
        p_excluded_savings_goal_ids: [OVERDUE_GOAL_UUID],
      }),
    );
  });

  it('keeps a goal whose target period is the budget period itself', async () => {
    // payDay 27: 12.11.2026 belongs to period 11/2026 — the deadline period is
    // contributive (docs/SAVINGS.md §4.2, formule 5: échéance incluse).
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const repo = new SupabaseBudgetRepository(
      generationProvider(
        [
          {
            id: ON_TIME_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: null,
            target_date: '2026-11-12',
          },
        ],
        27,
        rpc,
      ),
      createMockEncryption(),
    );

    await repo.createBudgetFromTemplateRpc(payload);

    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({ p_excluded_savings_goal_ids: [] }),
    );
  });

  it('keeps an undated goal active for future budget generation', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const repo = new SupabaseBudgetRepository(
      generationProvider(
        [
          {
            id: ON_TIME_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: null,
            target_date: null,
          },
        ],
        27,
        rpc,
      ),
      createMockEncryption(),
    );

    await repo.createBudgetFromTemplateRpc(payload);

    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({ p_excluded_savings_goal_ids: [] }),
    );
  });

  it('excludes an undated goal before its explicit start period', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const repo = new SupabaseBudgetRepository(
      generationProvider(
        [
          {
            id: ON_TIME_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: '2026-12-01',
            target_date: null,
          },
        ],
        27,
        rpc,
      ),
      createMockEncryption(),
    );

    await repo.createBudgetFromTemplateRpc(payload);

    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({
        p_excluded_savings_goal_ids: [ON_TIME_GOAL_UUID],
      }),
    );
  });

  it('never re-reads the pay day from GoTrue — the guard already carries it', async () => {
    // The guard fetches user_metadata once per request; re-asking here cost
    // `generate-budgets` up to 36 redundant round-trips.
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const getUser = jest.fn();
    const repo = new SupabaseBudgetRepository(
      generationProvider(
        [
          {
            id: OVERDUE_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: null,
            target_date: '2026-10-12',
          },
        ],
        27,
        rpc,
        getUser,
      ),
      createMockEncryption(),
    );

    await repo.createBudgetFromTemplateRpc(payload);

    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({
        p_excluded_savings_goal_ids: [OVERDUE_GOAL_UUID],
      }),
    );
  });

  it('sends an empty exclusion list when the user has no goal', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: rpcResponse, error: null });
    const getUser = jest.fn();
    const repo = new SupabaseBudgetRepository(
      generationProvider([], null, rpc, getUser),
      createMockEncryption(),
    );

    const result = await repo.createBudgetFromTemplateRpc(payload);

    expect(result.budget.id).toBe(BUDGET_UUID);
    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'create_budget_from_template',
      expect.objectContaining({
        p_excluded_savings_goal_ids: [],
        p_month: 11,
        p_year: 2026,
      }),
    );
  });

  describe('periodsOutsideInterval (PUL-312/PUL-314)', () => {
    function horizonProvider(
      goals: {
        id: string;
        created_at: string;
        start_date: string | null;
        target_date: string | null;
      }[],
      payDayOfMonth: number | null,
    ): {
      provider: AuthenticatedSupabaseProvider;
      from: ReturnType<typeof jest.fn>;
      eq: ReturnType<typeof jest.fn>;
      inFilter: ReturnType<typeof jest.fn>;
    } {
      const result = Promise.resolve({ data: goals, error: null });
      const query = {
        eq: jest.fn(),
        in: jest.fn(),
        then: result.then.bind(result),
      };
      query.eq.mockReturnValue(query);
      query.in.mockReturnValue(query);

      const from = jest.fn().mockImplementation((table: string) => {
        if (table !== 'savings_goal') {
          throw new Error(`unexpected table: ${table}`);
        }
        return { select: () => query };
      });
      const client = { from } as unknown as AuthenticatedSupabaseClient;
      const provider = {
        get client() {
          return client;
        },
        get user() {
          return { ...mockUser, id: USER_UUID, payDayOfMonth };
        },
      } as unknown as AuthenticatedSupabaseProvider;

      return {
        provider,
        from,
        eq: query.eq,
        inFilter: query.in,
      };
    }

    it('resolves distinct exclusions for multiple goals, including PAUSED, in one payDay-aware query', async () => {
      const FIRST_GOAL_UUID = '11111111-2222-4333-8444-555555555555';
      const SECOND_GOAL_UUID = '66666666-7777-4888-8999-aaaaaaaaaaaa';
      const UNDATED_GOAL_UUID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
      const requestedGoalIds = [
        FIRST_GOAL_UUID,
        SECOND_GOAL_UUID,
        FIRST_GOAL_UUID,
        UNDATED_GOAL_UUID,
      ];
      const periods: MaterializedBudgetPeriod[] = [
        { id: 'budget-10-2026', month: 10, year: 2026 },
        { id: 'budget-11-2026', month: 11, year: 2026 },
        { id: 'budget-01-2027', month: 1, year: 2027 },
      ];
      const { provider, from, eq, inFilter } = horizonProvider(
        [
          {
            id: FIRST_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: '2026-10-01',
            target_date: '2026-10-12',
          },
          {
            id: SECOND_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: null,
            target_date: '2026-11-12',
          },
          {
            id: UNDATED_GOAL_UUID,
            created_at: '2026-01-01T00:00:00Z',
            start_date: '2026-11-01',
            target_date: null,
          },
        ],
        27,
      );
      const repo = new SupabaseBudgetRepository(
        provider,
        createMockEncryption(),
      );

      const exclusions = await repo.periodsOutsideInterval(
        requestedGoalIds,
        periods,
      );

      expect(from).toHaveBeenCalledTimes(1);
      expect(inFilter).toHaveBeenCalledWith('id', [
        FIRST_GOAL_UUID,
        SECOND_GOAL_UUID,
        UNDATED_GOAL_UUID,
      ]);
      expect(eq).toHaveBeenCalledWith('user_id', USER_UUID);
      expect(eq).not.toHaveBeenCalledWith('status', expect.anything());
      expect(exclusions).toEqual(
        new Map([
          [FIRST_GOAL_UUID, ['budget-11-2026', 'budget-01-2027']],
          [SECOND_GOAL_UUID, ['budget-01-2027']],
          [UNDATED_GOAL_UUID, ['budget-10-2026']],
        ]),
      );
    });

    it('does not query when no linked goal or no materialized period is supplied', async () => {
      const { provider, from } = horizonProvider([], null);
      const repo = new SupabaseBudgetRepository(
        provider,
        createMockEncryption(),
      );

      expect(await repo.periodsOutsideInterval([], [])).toEqual(new Map());
      expect(
        await repo.periodsOutsideInterval([OVERDUE_GOAL_UUID], []),
      ).toEqual(new Map());
      expect(from).not.toHaveBeenCalled();
    });
  });
});

describe('SupabaseBudgetRepository fetchBudgetData ordering', () => {
  // Instantiating a budget from a template inserts every line in one statement,
  // so `created_at` ties for the whole month and Postgres resolves the tie by
  // physical heap order — which an UPDATE moves. Without a second key, checking
  // a line reshuffled the list and undoing the check never put it back.
  it('breaks the created_at tie on a stable key', async () => {
    const provider = fetchBudgetDataProvider(budgetLineRow);
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    await repo.fetchBudgetData('budget-1');

    expect(budgetLineOrderSpy).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(budgetLineOrderSpy).toHaveBeenCalledWith('id', { ascending: true });
  });
});

describe('SupabaseBudgetRepository toBudgetLineDecrypted', () => {
  it('maps spread_group_id (snake) to spreadGroupId (camel) when set', async () => {
    const provider = fetchBudgetDataProvider({
      ...budgetLineRow,
      spread_group_id: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      savings_withdrawal_group_id: null,
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.budgetLines[0].spreadGroupId).toBe(
      'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    );
  });

  it('maps a null spread_group_id to null', async () => {
    const provider = fetchBudgetDataProvider({
      ...budgetLineRow,
      spread_group_id: null,
      savings_withdrawal_group_id: null,
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.budgetLines[0].spreadGroupId).toBeNull();
  });

  // Même exigence que sur le réel (PUL-329) : la prévision qui annonce un
  // retrait doit ressortir de la lecture avec son objectif source, sinon le
  // détail du budget la sert anonyme et rien en aval ne peut la reconnaître.
  it('carries source_savings_goal_id/name from a select(*) row into the decrypted line', async () => {
    const provider = fetchBudgetDataProvider({
      ...budgetLineRow,
      kind: 'income',
      source_savings_goal_id: 'goal-1',
      source_savings_goal_name: 'Vacances',
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.budgetLines[0].sourceSavingsGoalId).toBe('goal-1');
    expect(result.budgetLines[0].sourceSavingsGoalName).toBe('Vacances');
  });

  it('maps a null source_savings_goal_id/name to null for an ordinary line', async () => {
    const provider = fetchBudgetDataProvider(budgetLineRow);
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.budgetLines[0].sourceSavingsGoalId).toBeNull();
    expect(result.budgetLines[0].sourceSavingsGoalName).toBeNull();
  });
});

describe('SupabaseBudgetRepository toTransactionDecrypted (PUL-329)', () => {
  const transactionRow: TransactionRow = {
    id: 'tx-1',
    budget_id: 'budget-1',
    budget_line_id: null,
    name: 'Salaire',
    amount: 'encrypted-3000',
    kind: 'income',
    transaction_date: '2026-01-05',
    checked_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    original_amount: null,
    original_currency: null,
    target_currency: null,
    exchange_rate: null,
    source_savings_goal_id: 'goal-1',
    source_savings_goal_name: 'Vacances',
  };

  function fetchBudgetDataTransactionProvider(
    txRow: TransactionRow,
  ): AuthenticatedSupabaseProvider {
    return createMockProvider((table: string) => {
      if (table === 'monthly_budget') {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: budgetRow, error: null }),
            }),
          }),
        };
      }
      if (table === 'budget_line') {
        return {
          select: () => ({
            eq: () => emptyBudgetLineQuery(),
          }),
        };
      }
      // transaction
      return {
        select: () => ({
          eq: () => ({
            order: jest.fn().mockResolvedValue({ data: [txRow], error: null }),
          }),
        }),
      };
    });
  }

  it('carries source_savings_goal_id/name from a select(*) row into the decrypted entity, not null', async () => {
    const provider = fetchBudgetDataTransactionProvider(transactionRow);
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.transactions[0].sourceSavingsGoalId).toBe('goal-1');
    expect(result.transactions[0].sourceSavingsGoalName).toBe('Vacances');
  });

  it('maps null source_savings_goal_id/name to null for an ordinary transaction', async () => {
    const provider = fetchBudgetDataTransactionProvider({
      ...transactionRow,
      source_savings_goal_id: null,
      source_savings_goal_name: null,
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.transactions[0].sourceSavingsGoalId).toBeNull();
    expect(result.transactions[0].sourceSavingsGoalName).toBeNull();
  });
});
