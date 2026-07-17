import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import { SupabaseBudgetLineRepository } from './infrastructure/persistence/supabase-budget-line.repository';
import { SavingsWithdrawalPairExistsError } from './domain/savings-withdrawal-conflict.error';
import type { SavingsWithdrawalPairInputs } from './domain/budget-line.entity';

/**
 * PUL-292 — the constraint-guarded seams of the savings-withdrawal pair,
 * end-to-end against real local Supabase. Unlike PUL-17 there is no RPC: the
 * atomicity AND the idempotency both hang on PostgREST/Postgres behavior the
 * unit suites can only mock —
 *  1. a multi-row INSERT is one statement → all-or-nothing (a failing saving
 *     side must roll back the income side);
 *  2. the partial UNIQUE index `(savings_withdrawal_group_id, kind)` fires a
 *     real 23505 whose shape the repository translates into the typed
 *     `SavingsWithdrawalPairExistsError` the use case replays on — if
 *     supabase-js surfaced the constraint name elsewhere, detection would
 *     silently miss → 500 instead of replay → duplicate-on-retry resurrects;
 *  3. under REAL concurrency, exactly one of two same-key inserts commits;
 *  4. the grouped DELETE scopes (`pair` / `repayment`) remove exactly the
 *     intended sides in one statement.
 */
describe('Savings withdrawal pair — constraint seams (local Supabase)', () => {
  let hasSupabase = false;
  let env: SupabaseEnv;
  let adminClient: SupabaseClient<Database>;
  let authClient: SupabaseClient<Database>;
  let repository: SupabaseBudgetLineRepository;

  const userEmail = `savings-withdrawal-it-${Date.now()}@test.local`;
  const userPassword = 'test-password-123';
  let userId = '';
  const templateId = randomUUID();
  const budgetJulyId = randomUUID();
  const budgetAugustId = randomUUID();

  const makePairInputs = (
    savingBudgetId: string = budgetAugustId,
  ): SavingsWithdrawalPairInputs => ({
    income: {
      budgetId: budgetJulyId,
      name: 'Mon épargne',
      amount: 280,
      kind: 'income',
      recurrence: 'one_off',
      savingsGoalId: null,
      originalAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
    },
    saving: {
      budgetId: savingBudgetId,
      name: 'Remettre sur ton épargne',
      amount: 280,
      kind: 'saving',
      recurrence: 'one_off',
      savingsGoalId: null,
      originalAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
    },
  });

  const countGroupRows = async (groupId: string): Promise<number> => {
    const { count } = await adminClient
      .from('budget_line')
      .select('id', { count: 'exact', head: true })
      .eq('savings_withdrawal_group_id', groupId);
    return count ?? 0;
  };

  beforeAll(async () => {
    const resolved = await ensureSupabaseAvailable().catch((error) => {
      if (IS_DEDICATED_INTEGRATION_RUN) throw error;
      return null;
    });
    if (!resolved) return;
    env = resolved;
    adminClient = createClient<Database>(env.apiUrl, env.serviceRoleKey);

    const { data: created, error: createErr } =
      await adminClient.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
    if (createErr || !created?.user) {
      throw new Error(
        `Failed to create test user: ${createErr?.message ?? 'unknown'}`,
      );
    }
    userId = created.user.id;

    await adminClient.from('template').insert({
      id: templateId,
      user_id: userId,
      name: 'Savings Withdrawal Template',
      is_default: true,
    });
    await adminClient.from('monthly_budget').insert([
      {
        id: budgetJulyId,
        user_id: userId,
        template_id: templateId,
        month: 7,
        year: 2026,
        description: 'Savings Withdrawal July',
      },
      {
        id: budgetAugustId,
        user_id: userId,
        template_id: templateId,
        month: 8,
        year: 2026,
        description: 'Savings Withdrawal August',
      },
    ]);

    authClient = createClient<Database>(env.apiUrl, env.anonKey);
    const { error: signInErr } = await authClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (signInErr) throw new Error(`Failed to sign in: ${signInErr.message}`);

    const providerStub = {
      client: authClient as unknown as AuthenticatedSupabaseClient,
      user: {
        id: userId,
        clientKey: Buffer.alloc(32),
      } as unknown as AuthenticatedUser,
    } as unknown as AuthenticatedSupabaseProvider;

    // The seams under test never depend on real crypto: amounts are opaque
    // ciphertexts to Postgres, and decryption is stubbed to a constant.
    const encryptionStub = {
      prepareAmountData: async (amount: number) => ({
        amount: `enc-${amount}`,
      }),
      encryptOptionalAmount: async (amount: number | null | undefined) =>
        amount == null ? null : `enc-${amount}`,
      getDekFor: async () => Buffer.alloc(32),
      decryptRowAmountFields: (row: Record<string, unknown>) => ({
        ...row,
        amount: 280,
        original_amount: null,
      }),
    } as unknown as EncryptionPort;

    repository = new SupabaseBudgetLineRepository(providerStub, encryptionStub);

    hasSupabase = true;
  });

  afterAll(async () => {
    if (!userId) return;
    await adminClient
      .from('budget_line')
      .delete()
      .in('budget_id', [budgetJulyId, budgetAugustId]);
    await adminClient
      .from('monthly_budget')
      .delete()
      .in('id', [budgetJulyId, budgetAugustId]);
    await adminClient.from('template').delete().eq('id', templateId);
    await adminClient.auth.admin.deleteUser(userId);
  });

  it('creates the pair atomically: income on M and saving on M+1 share the group', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    const lines = await repository.createSavingsWithdrawalPair(
      groupId,
      makePairInputs(),
    );

    expect(lines).toHaveLength(2);
    const kinds = lines.map((line) => line.kind).sort();
    expect(kinds).toEqual(['income', 'saving']);
    expect(
      lines.every((line) => line.savingsWithdrawalGroupId === groupId),
    ).toBe(true);
    expect(await countGroupRows(groupId)).toBe(2);
  });

  it('rolls back the WHOLE pair when the saving side cannot be inserted', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    const inputs = makePairInputs(randomUUID());

    await expect(
      repository.createSavingsWithdrawalPair(groupId, inputs),
    ).rejects.toThrow();
    expect(await countGroupRows(groupId)).toBe(0);
  });

  it('translates the real 23505 unique-index violation into the typed pair-exists error', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    await repository.createSavingsWithdrawalPair(groupId, makePairInputs());

    await expect(
      repository.createSavingsWithdrawalPair(groupId, makePairInputs()),
    ).rejects.toBeInstanceOf(SavingsWithdrawalPairExistsError);
    expect(await countGroupRows(groupId)).toBe(2);
  });

  it('lets exactly one of two concurrent same-key pair inserts commit', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    const results = await Promise.allSettled([
      repository.createSavingsWithdrawalPair(groupId, makePairInputs()),
      repository.createSavingsWithdrawalPair(groupId, makePairInputs()),
    ]);

    const winners = results.filter((r) => r.status === 'fulfilled');
    const losers = results.filter((r) => r.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      SavingsWithdrawalPairExistsError,
    );
    expect(await countGroupRows(groupId)).toBe(2);
  });

  it('deletes only the M+1 saving for scope repayment, the income keeps its group id', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    await repository.createSavingsWithdrawalPair(groupId, makePairInputs());

    await repository.deleteSavingsWithdrawalGroup(groupId, 'repayment');

    const remaining = await repository.findBySavingsWithdrawalGroupId(groupId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].kind).toBe('income');
    expect(remaining[0].savingsWithdrawalGroupId).toBe(groupId);
  });

  it('deletes both lines for scope pair', async () => {
    if (!hasSupabase) return;

    const groupId = randomUUID();
    await repository.createSavingsWithdrawalPair(groupId, makePairInputs());

    await repository.deleteSavingsWithdrawalGroup(groupId, 'pair');

    expect(await countGroupRows(groupId)).toBe(0);
  });
});
