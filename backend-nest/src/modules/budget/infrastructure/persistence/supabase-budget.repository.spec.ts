import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetRepository } from './supabase-budget.repository';
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

describe('SupabaseBudgetRepository toBudgetLineDecrypted', () => {
  it('maps spread_group_id (snake) to spreadGroupId (camel) when set', async () => {
    const provider = fetchBudgetDataProvider({
      ...budgetLineRow,
      spread_group_id: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
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
    });
    const repo = new SupabaseBudgetRepository(provider, createMockEncryption());

    const result = await repo.fetchBudgetData('budget-1');

    expect(result.budgetLines[0].spreadGroupId).toBeNull();
  });
});
