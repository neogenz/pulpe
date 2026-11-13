/**
 * create_budgets_from_template — the spread path that provisions several
 * missing months in one transaction.
 *
 * Exercises the real local Postgres (RLS + auth.uid()), not mocks. Skips
 * cleanly when local Supabase is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';

const PASSWORD = 'test-password-123';

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
const createdUserIds: string[] = [];

type TestUser = {
  id: string;
  client: SupabaseClient<Database>;
  templateId: string;
  goalId: string;
};

/** A user owning a template with one plain line and one goal-linked line. */
async function makeUserWithTemplate(): Promise<TestUser> {
  const email = `batch-budgets-${crypto.randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message}`);
  }
  createdUserIds.push(data.user.id);
  const client = createClient<Database>(env!.apiUrl, env!.anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

  const templateId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  await admin.from('template').insert({
    id: templateId,
    user_id: data.user.id,
    name: 'T',
    is_default: false,
  });
  await admin.from('savings_goal').insert({
    id: goalId,
    user_id: data.user.id,
    name: 'Voiture',
    target_amount: 'enc',
    target_date: '2099-12-01',
    status: 'ACTIVE',
  });
  await admin.from('template_line').insert([
    {
      template_id: templateId,
      name: 'Loyer',
      amount: 'enc',
      kind: 'expense',
      recurrence: 'fixed',
    },
    {
      template_id: templateId,
      name: 'Épargne',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: goalId,
    },
  ]);
  return { id: data.user.id, client, templateId, goalId };
}

const period = (month: number, year: number) => ({
  month,
  year,
  description: `Budget ${month}/${year}`,
});

async function budgetsOf(userId: string) {
  const { data } = await admin
    .from('monthly_budget')
    .select('id, month, year, budget_line(name)')
    .eq('user_id', userId)
    .order('year')
    .order('month');
  return (data ?? []).map((budget) => ({
    period: `${budget.month}/${budget.year}`,
    lines: budget.budget_line.map((line) => line.name).sort(),
  }));
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

describe('create_budgets_from_template (RPC integration)', () => {
  it('creates non-consecutive periods in the requested order and returns their rows', async () => {
    if (!env) return;
    const user = await makeUserWithTemplate();

    const { data, error } = await user.client.rpc(
      'create_budgets_from_template',
      {
        p_user_id: user.id,
        p_template_id: user.templateId,
        p_periods: [period(11, 2098), period(2, 2098), period(1, 2099)],
      },
    );

    expect(error).toBeNull();
    const { budgets } = data as {
      budgets: { id: string; month: number; year: number; user_id: string }[];
    };
    expect(budgets.map((b) => `${b.month}/${b.year}`)).toEqual([
      '11/2098',
      '2/2098',
      '1/2099',
    ]);
    expect(budgets.every((b) => b.user_id === user.id)).toBe(true);
    expect(await budgetsOf(user.id)).toEqual([
      { period: '2/2098', lines: ['Loyer', 'Épargne'] },
      { period: '11/2098', lines: ['Loyer', 'Épargne'] },
      { period: '1/2099', lines: ['Loyer', 'Épargne'] },
    ]);
  });

  it('leaves a goal-linked line out of the periods that exclude its goal only', async () => {
    if (!env) return;
    const user = await makeUserWithTemplate();

    const { error } = await user.client.rpc('create_budgets_from_template', {
      p_user_id: user.id,
      p_template_id: user.templateId,
      p_periods: [period(3, 2098), period(4, 2098)],
      p_excluded_savings_goal_ids_by_period: { '4/2098': [user.goalId] },
    });

    expect(error).toBeNull();
    expect(await budgetsOf(user.id)).toEqual([
      { period: '3/2098', lines: ['Loyer', 'Épargne'] },
      { period: '4/2098', lines: ['Loyer'] },
    ]);
  });

  it('creates nothing when one of the periods already has a budget', async () => {
    if (!env) return;
    const user = await makeUserWithTemplate();
    await admin.from('monthly_budget').insert({
      user_id: user.id,
      template_id: user.templateId,
      month: 6,
      year: 2098,
      description: '',
    });

    const { error } = await user.client.rpc('create_budgets_from_template', {
      p_user_id: user.id,
      p_template_id: user.templateId,
      p_periods: [period(5, 2098), period(6, 2098), period(7, 2098)],
    });

    expect(error?.message).toContain('Budget already exists for this period');
    expect(await budgetsOf(user.id)).toEqual([{ period: '6/2098', lines: [] }]);
  });

  it("refuses to create budgets for another user or from another user's template", async () => {
    if (!env) return;
    const owner = await makeUserWithTemplate();
    const intruder = await makeUserWithTemplate();

    const asOwner = await intruder.client.rpc('create_budgets_from_template', {
      p_user_id: owner.id,
      p_template_id: owner.templateId,
      p_periods: [period(8, 2098)],
    });
    const fromForeignTemplate = await intruder.client.rpc(
      'create_budgets_from_template',
      {
        p_user_id: intruder.id,
        p_template_id: owner.templateId,
        p_periods: [period(8, 2098)],
      },
    );

    expect(asOwner.error?.message).toContain('User access denied');
    expect(fromForeignTemplate.error?.message).toContain(
      'Template not found or access denied',
    );
    expect(await budgetsOf(owner.id)).toEqual([]);
    expect(await budgetsOf(intruder.id)).toEqual([]);
  });

  it('rejects an empty or oversized period list', async () => {
    if (!env) return;
    const user = await makeUserWithTemplate();
    const call = (periods: ReturnType<typeof period>[]) =>
      user.client.rpc('create_budgets_from_template', {
        p_user_id: user.id,
        p_template_id: user.templateId,
        p_periods: periods,
      });

    const empty = await call([]);
    const oversized = await call(
      Array.from({ length: 37 }, (_, i) => period((i % 12) + 1, 2060 + i)),
    );

    expect(empty.error?.message).toContain('Invalid budget periods');
    expect(oversized.error?.message).toContain('Invalid budget periods');
    expect(await budgetsOf(user.id)).toEqual([]);
  });

  // The per-month RPC deadlocked (40P01) when called concurrently for one
  // user: each copy bumps the same savings_goal row through the budget_line
  // revision trigger. The batch serializes on the user's advisory lock.
  it('lets two concurrent batches for one user both succeed', async () => {
    if (!env) return;
    const user = await makeUserWithTemplate();
    const batch = (year: number) =>
      user.client.rpc('create_budgets_from_template', {
        p_user_id: user.id,
        p_template_id: user.templateId,
        p_periods: Array.from({ length: 12 }, (_, i) => period(i + 1, year)),
      });

    const results = await Promise.all([batch(2096), batch(2097)]);

    expect(results.map((result) => result.error)).toEqual([null, null]);
    expect(await budgetsOf(user.id)).toHaveLength(24);
  });
});
