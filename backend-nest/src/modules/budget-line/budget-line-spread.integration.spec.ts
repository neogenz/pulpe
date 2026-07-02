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
import { SpreadGroupAlreadyExistsError } from './domain/spread-group-conflict.error';
import { SPREAD_GROUP_EXISTS_RPC_MESSAGE } from './infrastructure/persistence/schemas/rpc-payload.schemas';
import type { BudgetLineCreateInput } from './domain/budget-line.entity';

/**
 * PUL-17 — the ERROR-DETECTION SEAM of the spread idempotency guard, end-to-end
 * against real local Supabase.
 *
 * The unit suites prove each link in ISOLATION with mocks: the SQL test proves the
 * RPC RAISEs the message; the repo spec proves a MOCK `{ message }` maps to the
 * typed error; the use-case spec proves the typed error triggers a replay. None of
 * them proves the SEAM: that a real Postgres `P0001` raise, as wrapped by
 * supabase-js, actually reaches the repository with the dup-group message in the
 * field `throwSpreadRpcError` inspects (`.message`). If supabase-js surfaced it
 * elsewhere (`.details`/`.hint`), or the SQL literal drifted from the TS constant,
 * detection would silently miss → 500 instead of replay → the duplicate-on-retry
 * bug resurrects, and no mocked unit test would catch it.
 *
 * These tests close that gap by hitting the real RPC:
 *  1. the raw supabase-js error SHAPE (code + the message the TS constant matches);
 *  2. the production repository path translating that real raise into the typed
 *     `SpreadGroupAlreadyExistsError` the use case replays on.
 *
 * The replay outcome itself (return the existing lines, no duplicate) is pure
 * orchestration on top of this typed error and stays unit-covered.
 */
describe('Spread idempotency guard — error-detection seam (local Supabase)', () => {
  let hasSupabase = false;
  let env: SupabaseEnv;
  let adminClient: SupabaseClient<Database>;
  let authClient: SupabaseClient<Database>;

  const userEmail = `spread-it-${Date.now()}@test.local`;
  const userPassword = 'test-password-123';
  let userId = '';
  const templateId = randomUUID();
  const budgetId = randomUUID();
  const seedLineId = randomUUID();
  // The idempotency key under test: the seeded line already owns this group, so
  // any create reusing it must hit the dup-group guard.
  const spreadGroupId = randomUUID();

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
      name: 'Spread Idempotency Template',
      is_default: true,
    });
    await adminClient.from('monthly_budget').insert({
      id: budgetId,
      user_id: userId,
      template_id: templateId,
      month: 1,
      year: 2026,
      description: 'Spread Idempotency Budget',
    });
    // Seed ONE line already carrying the group → the group "exists" so the RPC's
    // top-of-function guard RAISEs on any create reusing this id. The amount is an
    // opaque ciphertext column; a dummy string suffices (the guard never reads it).
    const { error: seedErr } = await adminClient.from('budget_line').insert({
      id: seedLineId,
      budget_id: budgetId,
      name: 'Seed spread line',
      amount: 'seed-ciphertext',
      kind: 'expense',
      recurrence: 'one_off',
      is_manually_adjusted: false,
      spread_group_id: spreadGroupId,
    });
    if (seedErr) throw seedErr;

    authClient = createClient<Database>(env.apiUrl, env.anonKey);
    const { error: signInErr } = await authClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (signInErr) throw new Error(`Failed to sign in: ${signInErr.message}`);

    hasSupabase = true;
  });

  afterAll(async () => {
    if (!userId) return;
    await adminClient.from('budget_line').delete().eq('budget_id', budgetId);
    await adminClient.from('monthly_budget').delete().eq('id', budgetId);
    await adminClient.from('template').delete().eq('id', templateId);
    await adminClient.auth.admin.deleteUser(userId);
  });

  it('raises a P0001 whose message the TS dup-group constant matches', async () => {
    if (!hasSupabase) return;

    const { error } = await authClient.rpc('create_budget_lines_spread', {
      p_spread_group_id: spreadGroupId,
      p_lines: [],
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('P0001');
    expect(error?.message).toContain(SPREAD_GROUP_EXISTS_RPC_MESSAGE);
  });

  it('translates the real RPC raise into a typed SpreadGroupAlreadyExistsError', async () => {
    if (!hasSupabase) return;

    const providerStub = {
      client: authClient as unknown as AuthenticatedSupabaseClient,
      user: {
        id: userId,
        clientKey: Buffer.alloc(32),
      } as unknown as AuthenticatedUser,
    } as unknown as AuthenticatedSupabaseProvider;

    // The guard fires before any amount is read, so encryption is irrelevant here.
    const encryptionStub = {
      prepareAmountData: async (amount: number) => ({
        amount: `enc-${amount}`,
      }),
      encryptOptionalAmount: async (amount: number | null | undefined) =>
        amount == null ? null : `enc-${amount}`,
    } as unknown as EncryptionPort;

    const repository = new SupabaseBudgetLineRepository(
      providerStub,
      encryptionStub,
    );

    const retryInput: BudgetLineCreateInput = {
      budgetId,
      name: 'Retry attempt',
      amount: 150,
      kind: 'expense',
      recurrence: 'one_off',
      savingsGoalId: null,
      originalAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
    };

    await expect(
      repository.createSpread(spreadGroupId, [retryInput]),
    ).rejects.toBeInstanceOf(SpreadGroupAlreadyExistsError);
  });

  // PUL-286 — the guard under REAL concurrency, not just the sequential replay
  // case above (group pre-seeded, single call). Two parallel RPC calls race on a
  // FRESH group id: the advisory xact lock must serialize them so exactly one
  // fans out and the other trips the EXISTS guard after the winner commits. A
  // broken lock (or a guard checked before acquiring it) would let both insert
  // → 6 rows sharing one group — the duplicate-on-retry bug, undetectable by
  // any single-call test.
  it('lets exactly one of two concurrent same-key calls fan out', async () => {
    if (!hasSupabase) return;

    const raceGroupId = randomUUID();
    const buildLines = (caller: string) =>
      [1, 2, 3].map((tranche) => ({
        budget_id: budgetId,
        name: `${caller}-tranche-${tranche}`,
        amount: `ciphertext-${caller}-${tranche}`,
        kind: 'expense',
        recurrence: 'one_off',
        savings_goal_id: null,
        original_amount: null,
        original_currency: null,
        target_currency: null,
        exchange_rate: null,
      }));

    const results = await Promise.all([
      authClient.rpc('create_budget_lines_spread', {
        p_spread_group_id: raceGroupId,
        p_lines: buildLines('racer-a'),
      }),
      authClient.rpc('create_budget_lines_spread', {
        p_spread_group_id: raceGroupId,
        p_lines: buildLines('racer-b'),
      }),
    ]);

    const winners = results.filter((result) => result.error === null);
    const losers = results.filter((result) => result.error !== null);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    expect(losers[0].error?.code).toBe('P0001');
    expect(losers[0].error?.message).toContain(SPREAD_GROUP_EXISTS_RPC_MESSAGE);

    const winnerRows = winners[0].data ?? [];
    expect(winnerRows).toHaveLength(3);

    const { data: persisted, error: readErr } = await adminClient
      .from('budget_line')
      .select('id, name')
      .eq('spread_group_id', raceGroupId);
    expect(readErr).toBeNull();

    // The surviving group is EXACTLY the winner's fan-out: no rows from the
    // loser (partial or full), no duplicate group.
    const persistedIds = (persisted ?? []).map((row) => row.id).sort();
    const winnerIds = winnerRows.map((row) => row.id).sort();
    expect(persistedIds).toEqual(winnerIds);

    const winnerPrefix = winnerRows[0].name.startsWith('racer-a')
      ? 'racer-a'
      : 'racer-b';
    const allFromWinner = (persisted ?? []).every((row) =>
      row.name.startsWith(winnerPrefix),
    );
    expect(allFromWinner).toBe(true);
  });
});
