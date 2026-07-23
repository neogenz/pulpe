import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetRepository } from './supabase-budget.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetLineRow } from '../../domain/budget.entity';
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
  name: 'Prime assurance',
  amount: 'encrypted-100',
  kind: 'expense',
  recurrence: 'one_off',
  is_manually_adjusted: false,
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

function fetchBudgetDataProvider(
  lineRow: BudgetLineRow,
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
          eq: () => ({
            order: jest
              .fn()
              .mockResolvedValue({ data: [lineRow], error: null }),
          }),
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
});
