import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from '../../domain/budget-line.entity';
import { SupabaseBudgetLineSpreadReader } from './supabase-budget-line-spread.reader';

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
  spread_group_id: 'group-1',
  savings_withdrawal_group_id: null,
  source_savings_goal_id: null,
  source_savings_goal_name: null,
  name: 'Loyer',
  amount: '100',
  kind: 'expense',
  recurrence: 'one_off',
  is_manually_adjusted: false,
  is_savings_goal_plan_adjustment: false,
  checked_at: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

function createMockProvider(
  from: (table: string) => unknown,
): AuthenticatedSupabaseProvider {
  const client = { from } as unknown as AuthenticatedSupabaseClient;
  return {
    get client() {
      return client;
    },
    get user() {
      return mockUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

function createPassthroughEncryption(): EncryptionPort {
  return {
    getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
    decryptRowAmountFields: jest.fn().mockImplementation((row) => ({
      ...row,
      amount: Number(row.amount),
      original_amount: null,
    })),
  } as unknown as EncryptionPort;
}

describe('SupabaseBudgetLineSpreadReader', () => {
  it('attaches consumed amounts and transaction counts to each occurrence', async () => {
    const occurrences = [
      {
        ...mockRow,
        id: 'line-1',
        budget_id: 'budget-1',
        monthly_budget: { month: 5, year: 2026, user_id: mockUser.id },
      },
      {
        ...mockRow,
        id: 'line-2',
        budget_id: 'budget-2',
        monthly_budget: { month: 6, year: 2026, user_id: mockUser.id },
      },
    ];
    const transactions = [
      { budget_line_id: 'line-1', amount: '30' },
      { budget_line_id: 'line-1', amount: '50' },
    ];
    const reader = new SupabaseBudgetLineSpreadReader(
      createMockProvider((table) =>
        table === 'transaction'
          ? {
              select: () => ({
                in: () => ({ data: transactions, error: null }),
              }),
            }
          : {
              select: () => ({
                eq: () => ({ data: occurrences, error: null }),
              }),
            },
      ),
      createPassthroughEncryption(),
    );

    const result = await reader.findOccurrences('group-1');

    expect(result).toEqual([
      expect.objectContaining({
        budgetLineId: 'line-1',
        consumed: 80,
        transactionCount: 2,
      }),
      expect.objectContaining({
        budgetLineId: 'line-2',
        consumed: 0,
        transactionCount: 0,
      }),
    ]);
  });

  it('returns an empty list without querying transactions when the group has no occurrences', async () => {
    const transactionSelect = jest.fn();
    const reader = new SupabaseBudgetLineSpreadReader(
      createMockProvider((table) =>
        table === 'transaction'
          ? { select: transactionSelect }
          : { select: () => ({ eq: () => ({ data: [], error: null }) }) },
      ),
      createPassthroughEncryption(),
    );

    const result = await reader.findOccurrences('group-empty');

    expect(result).toEqual([]);
    expect(transactionSelect).not.toHaveBeenCalled();
  });
});
