/**
 * PUL-285 CA5 — apply_savings_goal_generation_stop on the real local Postgres.
 *   - freeze: unlinks the requested future lines and flags them
 *     is_manually_adjusted (RG-001 shield); the prévision survives.
 *   - remove: deletes the lines; attached transactions become free
 *     (FK ON DELETE SET NULL).
 *   - CA9 guards: checked, manually adjusted, past-period and foreign lines
 *     are refused with a full rollback (nothing partially applied).
 *
 * Skips cleanly when local Supabase is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';

const PASSWORD = 'test-password-123';
// Budgets are seeded in 2099; month 4 is "past", months >= 5 are current/future.
const MIN_PERIOD_INDEX = 2099 * 12 + 5;

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
const createdUserIds: string[] = [];

async function makeUser(
  email: string,
): Promise<{ id: string; client: SupabaseClient<Database> }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message}`);
  }
  const client = createClient<Database>(env!.apiUrl, env!.anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return { id: data.user.id, client };
}

interface SeededGoal {
  user: { id: string; client: SupabaseClient<Database> };
  goalId: string;
  budgetIdByMonth: Map<number, string>;
}

async function seedGoalWithBudgets(months: number[]): Promise<SeededGoal> {
  const user = await makeUser(`sg-stop-${crypto.randomUUID()}@test.local`);
  createdUserIds.push(user.id);

  const templateId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  await admin.from('template').insert({
    id: templateId,
    user_id: user.id,
    name: 'T',
    is_default: false,
  });
  await admin.from('savings_goal').insert({
    id: goalId,
    user_id: user.id,
    name: 'Maison',
    target_amount: 'enc',
    target_date: '2099-12-01',
    status: 'PAUSED',
  });

  const budgetIdByMonth = new Map<number, string>();
  await admin.from('monthly_budget').insert(
    months.map((month) => {
      const id = crypto.randomUUID();
      budgetIdByMonth.set(month, id);
      return {
        id,
        user_id: user.id,
        template_id: templateId,
        month,
        year: 2099,
        description: '',
      };
    }),
  );

  return { user, goalId, budgetIdByMonth };
}

async function seedLinkedLine(
  seed: SeededGoal,
  month: number,
  options: { checkedAt?: string; isManuallyAdjusted?: boolean } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await admin.from('budget_line').insert({
    id,
    budget_id: seed.budgetIdByMonth.get(month)!,
    name: 'Épargne',
    amount: 'enc',
    kind: 'saving',
    recurrence: 'fixed',
    savings_goal_id: seed.goalId,
    is_manually_adjusted: options.isManuallyAdjusted ?? false,
    checked_at: options.checkedAt ?? null,
  });
  return id;
}

beforeAll(async () => {
  try {
    env = await ensureSupabaseAvailable();
  } catch {
    env = null;
    return;
  }
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);
});

afterAll(async () => {
  if (!env) return;
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
});

describe('PUL-285 — apply_savings_goal_generation_stop (RPC integration)', () => {
  it('freeze unlinks the future lines and shields them from RG-001', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([6, 7]);
    const lineJune = await seedLinkedLine(seed, 6);
    const lineJuly = await seedLinkedLine(seed, 7);

    const { data, error } = await seed.user.client.rpc(
      'apply_savings_goal_generation_stop',
      {
        p_goal_id: seed.goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [lineJune, lineJuly],
        p_min_period_index: MIN_PERIOD_INDEX,
      },
    );

    expect(error).toBeNull();
    expect(data?.length).toBe(2);

    const { data: lines } = await admin
      .from('budget_line')
      .select('id, savings_goal_id, is_manually_adjusted')
      .in('id', [lineJune, lineJuly]);
    expect(lines?.length).toBe(2);
    for (const line of lines ?? []) {
      expect(line.savings_goal_id).toBeNull();
      expect(line.is_manually_adjusted).toBe(true);
    }
  });

  it('remove deletes the future lines and frees their transactions', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([6]);
    const lineId = await seedLinkedLine(seed, 6);
    const transactionId = crypto.randomUUID();
    const { error: transactionSeedError } = await admin
      .from('transaction')
      .insert({
        id: transactionId,
        budget_id: seed.budgetIdByMonth.get(6)!,
        budget_line_id: lineId,
        name: 'Virement épargne',
        amount: 'enc',
        kind: 'saving',
        transaction_date: '2099-06-05T00:00:00Z',
      });
    expect(transactionSeedError).toBeNull();

    const { data, error } = await seed.user.client.rpc(
      'apply_savings_goal_generation_stop',
      {
        p_goal_id: seed.goalId,
        p_mode: 'remove',
        p_budget_line_ids: [lineId],
        p_min_period_index: MIN_PERIOD_INDEX,
      },
    );

    expect(error).toBeNull();
    expect(data?.length).toBe(1);

    const { data: removedLine } = await admin
      .from('budget_line')
      .select('id')
      .eq('id', lineId);
    expect(removedLine?.length).toBe(0);

    const { data: freedTransaction } = await admin
      .from('transaction')
      .select('budget_line_id')
      .eq('id', transactionId)
      .single();
    expect(freedTransaction?.budget_line_id).toBeNull();
  });

  it.each([
    [
      'checked',
      { checkedAt: '2099-06-01T00:00:00Z' },
      6,
      'Generation stop line already checked',
    ],
    [
      'manually adjusted',
      { isManuallyAdjusted: true },
      6,
      'Generation stop line manually adjusted',
    ],
    ['past-period', {}, 4, 'Generation stop line in past period'],
  ] as const)(
    'refuses a %s line and rolls back the whole batch',
    async (_label, options, month, expectedMessage) => {
      if (!env) return;

      const seed = await seedGoalWithBudgets([4, 6, 7]);
      const eligibleLine = await seedLinkedLine(seed, 7);
      const ineligibleLine = await seedLinkedLine(seed, month, options);

      const { error } = await seed.user.client.rpc(
        'apply_savings_goal_generation_stop',
        {
          p_goal_id: seed.goalId,
          p_mode: 'remove',
          p_budget_line_ids: [eligibleLine, ineligibleLine],
          p_min_period_index: MIN_PERIOD_INDEX,
        },
      );

      expect(error).not.toBeNull();
      expect(error?.message ?? '').toContain(expectedMessage);

      const { data: untouched } = await admin
        .from('budget_line')
        .select('id, savings_goal_id')
        .in('id', [eligibleLine, ineligibleLine]);
      expect(untouched?.length).toBe(2);
      for (const line of untouched ?? []) {
        expect(line.savings_goal_id).toBe(seed.goalId);
      }
    },
  );

  it('refuses a foreign goal and a line not linked to the goal', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([6]);
    const attacker = await makeUser(
      `sg-stop-atk-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id);

    const lineId = await seedLinkedLine(seed, 6);

    const { error: foreignGoalError } = await attacker.client.rpc(
      'apply_savings_goal_generation_stop',
      {
        p_goal_id: seed.goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [lineId],
        p_min_period_index: MIN_PERIOD_INDEX,
      },
    );
    expect(foreignGoalError?.message ?? '').toContain(
      'Savings goal access denied',
    );

    const { error: notLinkedError } = await seed.user.client.rpc(
      'apply_savings_goal_generation_stop',
      {
        p_goal_id: seed.goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [crypto.randomUUID()],
        p_min_period_index: MIN_PERIOD_INDEX,
      },
    );
    expect(notLinkedError?.message ?? '').toContain(
      'Generation stop line not linked',
    );
  });
});

describe('PUL-313 — reconcile_savings_goal_target_date (RPC integration)', () => {
  const targetPeriodIndex = 2099 * 12 + 6;
  const targetDate = '2099-06-15';

  it('freezes the exact post-deadline candidates and patches the goal atomically', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([4, 6, 7, 8]);
    const past = await seedLinkedLine(seed, 4);
    const atTarget = await seedLinkedLine(seed, 6);
    const candidate = await seedLinkedLine(seed, 7);
    const checked = await seedLinkedLine(seed, 7, {
      checkedAt: '2099-07-01T00:00:00Z',
    });
    const adjusted = await seedLinkedLine(seed, 8, {
      isManuallyAdjusted: true,
    });

    const { data, error } = await seed.user.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: seed.goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [candidate],
        p_min_period_index: MIN_PERIOD_INDEX,
        p_target_period_index: targetPeriodIndex,
        p_patch: {
          name: 'Maison proche',
          target_amount: 'enc:4000',
          target_date: targetDate,
        },
      },
    );

    expect(error).toBeNull();
    expect(data).toMatchObject({
      affected_line_ids: [candidate],
      touched_budget_ids: [seed.budgetIdByMonth.get(7)!],
      goal: {
        id: seed.goalId,
        name: 'Maison proche',
        target_amount: 'enc:4000',
        target_date: targetDate,
      },
    });

    const { data: lines } = await admin
      .from('budget_line')
      .select('id, savings_goal_id, is_manually_adjusted')
      .in('id', [past, atTarget, candidate, checked, adjusted]);
    const byId = new Map((lines ?? []).map((line) => [line.id, line]));
    expect(byId.get(candidate)).toMatchObject({
      savings_goal_id: null,
      is_manually_adjusted: true,
    });
    for (const id of [past, atTarget, checked, adjusted]) {
      expect(byId.get(id)?.savings_goal_id).toBe(seed.goalId);
    }
  });

  it('removes candidates and frees their transactions in the same goal patch', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([7]);
    const candidate = await seedLinkedLine(seed, 7);
    const transactionId = crypto.randomUUID();
    await admin.from('transaction').insert({
      id: transactionId,
      budget_id: seed.budgetIdByMonth.get(7)!,
      budget_line_id: candidate,
      name: 'Virement épargne',
      amount: 'enc',
      kind: 'saving',
      transaction_date: '2099-07-05T00:00:00Z',
    });

    const { error } = await seed.user.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: seed.goalId,
        p_mode: 'remove',
        p_budget_line_ids: [candidate],
        p_min_period_index: MIN_PERIOD_INDEX,
        p_target_period_index: targetPeriodIndex,
        p_patch: { target_date: targetDate },
      },
    );

    expect(error).toBeNull();
    const removed = await admin
      .from('budget_line')
      .select('id')
      .eq('id', candidate);
    expect(removed.data).toEqual([]);
    const transaction = await admin
      .from('transaction')
      .select('budget_line_id')
      .eq('id', transactionId)
      .single();
    expect(transaction.data?.budget_line_id).toBeNull();
    const goal = await admin
      .from('savings_goal')
      .select('target_date')
      .eq('id', seed.goalId)
      .single();
    expect(goal.data?.target_date).toBe(targetDate);
  });

  it('rolls back date and lines when the candidate set drifted', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([7, 8]);
    const confirmed = await seedLinkedLine(seed, 7);
    const appearedAfterPreview = await seedLinkedLine(seed, 8);

    const { error } = await seed.user.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: seed.goalId,
        p_mode: 'remove',
        p_budget_line_ids: [confirmed],
        p_min_period_index: MIN_PERIOD_INDEX,
        p_target_period_index: targetPeriodIndex,
        p_patch: { target_date: targetDate },
      },
    );

    expect(error?.message ?? '').toContain(
      'Savings goal reconciliation conflict',
    );
    const lines = await admin
      .from('budget_line')
      .select('id')
      .in('id', [confirmed, appearedAfterPreview]);
    expect(lines.data).toHaveLength(2);
    const goal = await admin
      .from('savings_goal')
      .select('target_date')
      .eq('id', seed.goalId)
      .single();
    expect(goal.data?.target_date).toBe('2099-12-01');
  });

  it.each([
    ['foreign id', {}],
    ['line became checked', { checkedAt: '2099-07-01T00:00:00Z' }],
  ] as const)(
    'rolls back on %s between preview and confirmation',
    async (_label, options) => {
      if (!env) return;

      const seed = await seedGoalWithBudgets([7]);
      const lineId =
        'checkedAt' in options
          ? await seedLinkedLine(seed, 7, options)
          : crypto.randomUUID();

      const { error } = await seed.user.client.rpc(
        'reconcile_savings_goal_target_date',
        {
          p_goal_id: seed.goalId,
          p_mode: 'freeze',
          p_budget_line_ids: [lineId],
          p_min_period_index: MIN_PERIOD_INDEX,
          p_target_period_index: targetPeriodIndex,
          p_patch: { target_date: targetDate },
        },
      );

      expect(error?.message ?? '').toContain(
        'Savings goal reconciliation conflict',
      );
      const goal = await admin
        .from('savings_goal')
        .select('target_date')
        .eq('id', seed.goalId)
        .single();
      expect(goal.data?.target_date).toBe('2099-12-01');
      if ('checkedAt' in options) {
        const line = await admin
          .from('budget_line')
          .select('savings_goal_id, is_manually_adjusted')
          .eq('id', lineId)
          .single();
        expect(line.data).toMatchObject({
          savings_goal_id: seed.goalId,
          is_manually_adjusted: false,
        });
      }
    },
  );

  it('rolls back candidate changes when the goal patch is invalid', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([7]);
    const candidate = await seedLinkedLine(seed, 7);

    const { error } = await seed.user.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: seed.goalId,
        p_mode: 'freeze',
        p_budget_line_ids: [candidate],
        p_min_period_index: MIN_PERIOD_INDEX,
        p_target_period_index: targetPeriodIndex,
        p_patch: {
          target_date: targetDate,
          status: 'INVALID',
        },
      },
    );

    expect(error).not.toBeNull();
    const line = await admin
      .from('budget_line')
      .select('savings_goal_id, is_manually_adjusted')
      .eq('id', candidate)
      .single();
    expect(line.data).toMatchObject({
      savings_goal_id: seed.goalId,
      is_manually_adjusted: false,
    });
    const goal = await admin
      .from('savings_goal')
      .select('target_date')
      .eq('id', seed.goalId)
      .single();
    expect(goal.data?.target_date).toBe('2099-12-01');
  });
});
