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

describe('PUL-18 — atomic template creation with tags', () => {
  it('persists tagIds with savingsGoalId and propagates both to a budget', async () => {
    if (!env) return;
    const user = await makeUser(`tpl-tags-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(user.id);
    const tagId = crypto.randomUUID();
    const goalId = crypto.randomUUID();

    await admin
      .from('tag')
      .insert({ id: tagId, user_id: user.id, name: 'Projet' });
    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: user.id,
      name: 'Maison',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const { data, error } = await user.client.rpc(
      'create_template_with_lines',
      {
        p_user_id: user.id,
        p_name: 'Mois projet',
        p_description: '',
        p_is_default: false,
        p_lines: [
          {
            name: 'Épargne maison',
            amount: 'enc',
            kind: 'saving',
            recurrence: 'fixed',
            savings_goal_id: goalId,
            tag_ids: [tagId],
            description: '',
            original_amount: null,
            original_currency: null,
            target_currency: null,
            exchange_rate: null,
          },
          {
            name: 'Loyer',
            amount: 'enc',
            kind: 'expense',
            recurrence: 'fixed',
            description: '',
            original_amount: null,
            original_currency: null,
            target_currency: null,
            exchange_rate: null,
          },
        ] as never,
      },
    );
    expect(error).toBeNull();

    const templateId = (data as { id: string }).id;
    const lineResult = await admin
      .from('template_line')
      .select('id, savings_goal_id, name')
      .eq('template_id', templateId)
      .eq('name', 'Épargne maison')
      .single();
    expect(lineResult.data?.savings_goal_id).toBe(goalId);
    const templateTags = await admin
      .from('template_line_tag')
      .select('tag_id')
      .eq('template_line_id', lineResult.data!.id);
    expect(templateTags.data).toEqual([{ tag_id: tagId }]);

    const generated = await user.client.rpc('create_budget_from_template', {
      p_user_id: user.id,
      p_template_id: templateId,
      p_month: 11,
      p_year: 2098,
      p_description: '',
    });
    expect(generated.error).toBeNull();
    const budgetId = (generated.data as { budget: { id: string } }).budget.id;
    const budgetLine = await admin
      .from('budget_line')
      .select('id, savings_goal_id')
      .eq('budget_id', budgetId)
      .eq('template_line_id', lineResult.data!.id)
      .single();
    expect(budgetLine.data?.savings_goal_id).toBe(goalId);
    const budgetTags = await admin
      .from('budget_line_tag')
      .select('tag_id')
      .eq('budget_line_id', budgetLine.data!.id);
    expect(budgetTags.data).toEqual([{ tag_id: tagId }]);
  });

  it('rejects missing or foreign tags and rolls back the whole template', async () => {
    if (!env) return;
    const attacker = await makeUser(
      `tpl-tags-atk-${crypto.randomUUID()}@test.local`,
    );
    const victim = await makeUser(
      `tpl-tags-vic-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id, victim.id);
    const foreignTagId = crypto.randomUUID();
    await admin.from('tag').insert({
      id: foreignTagId,
      user_id: victim.id,
      name: 'Privé',
    });

    for (const tagId of [foreignTagId, crypto.randomUUID()]) {
      const name = `Rejected ${tagId}`;
      const { error } = await attacker.client.rpc(
        'create_template_with_lines',
        {
          p_user_id: attacker.id,
          p_name: name,
          p_description: '',
          p_is_default: false,
          p_lines: [
            {
              name: 'Ligne',
              amount: 'enc',
              kind: 'expense',
              recurrence: 'fixed',
              tag_ids: [tagId],
              description: '',
              original_amount: null,
              original_currency: null,
              target_currency: null,
              exchange_rate: null,
            },
          ] as never,
        },
      );
      expect(error?.message ?? '').toContain('Tag access denied');

      const persisted = await admin
        .from('template')
        .select('id')
        .eq('user_id', attacker.id)
        .eq('name', name);
      expect(persisted.data).toEqual([]);
    }
  });
});
