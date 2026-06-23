/**
 * PUL-12 — savings_goal DB behaviour on the real local Postgres.
 *   - CA5: deleting a goal unlinks tagged budget_line + template_line rows
 *     (savings_goal_id -> null) via FK ON DELETE SET NULL; no prévision deleted.
 *   - CA7: RLS isolates savings_goal by user_id (a foreign user cannot read it).
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
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const client = createClient<Database>(env!.apiUrl, env!.anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
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

describe('PUL-12 — savings_goal DB integration', () => {
  it('CA5: deleting a goal unlinks tagged lines, deletes no prévision', async () => {
    if (!env) return;

    const user = await makeUser(`sg-del-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(user.id);

    const templateId = crypto.randomUUID();
    const templateLineId = crypto.randomUUID();
    const goalId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const budgetLineId = crypto.randomUUID();

    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: user.id,
      name: 'Maison',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });
    await admin.from('template').insert({
      id: templateId,
      user_id: user.id,
      name: 'T',
      is_default: false,
    });
    await admin.from('template_line').insert({
      id: templateLineId,
      template_id: templateId,
      name: 'Épargne',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: goalId,
    });
    await admin.from('monthly_budget').insert({
      id: budgetId,
      user_id: user.id,
      template_id: templateId,
      month: 1,
      year: 2099,
      description: '',
    });
    await admin.from('budget_line').insert({
      id: budgetLineId,
      budget_id: budgetId,
      template_line_id: templateLineId,
      name: 'Épargne',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalId,
    });

    const { error: delError } = await admin
      .from('savings_goal')
      .delete()
      .eq('id', goalId);
    expect(delError).toBeNull();

    const bl = await admin
      .from('budget_line')
      .select('id, savings_goal_id')
      .eq('id', budgetLineId)
      .single();
    expect(bl.data?.id).toBe(budgetLineId); // still exists
    expect(bl.data?.savings_goal_id).toBeNull(); // unlinked

    const tl = await admin
      .from('template_line')
      .select('id, savings_goal_id')
      .eq('id', templateLineId)
      .single();
    expect(tl.data?.id).toBe(templateLineId); // still exists
    expect(tl.data?.savings_goal_id).toBeNull(); // unlinked
  });

  it('CA7: RLS isolates savings_goal by user_id', async () => {
    if (!env) return;

    const owner = await makeUser(
      `sg-rls-own-${crypto.randomUUID()}@test.local`,
    );
    const other = await makeUser(
      `sg-rls-oth-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(owner.id, other.id);

    const goalId = crypto.randomUUID();
    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: owner.id,
      name: 'Privé',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const ownerView = await owner.client
      .from('savings_goal')
      .select('id')
      .eq('id', goalId);
    expect(ownerView.data?.length).toBe(1); // owner sees it

    const otherView = await other.client
      .from('savings_goal')
      .select('id')
      .eq('id', goalId);
    expect(otherView.data?.length ?? 0).toBe(0); // foreign user blocked by RLS
  });
});
