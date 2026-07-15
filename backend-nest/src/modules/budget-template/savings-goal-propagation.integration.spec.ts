/**
 * PUL-12 CA10 — savings_goal_id propagation through the SECURITY DEFINER RPCs.
 *
 * Exercises the real local Postgres (RLS + auth.uid()), not mocks:
 *   - the atomic scalar + tag wrapper propagates savings_goal_id to
 *     non-manually-adjusted budget_line rows and rolls back both link families.
 *   - is_manually_adjusted budget_line rows are protected.
 *   - PUL-272 cross-tenant budget guard still rejects a foreign budget_id.
 *   - create_budget_from_template copies the link into the generated budget.
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

const createdUserIds: string[] = [];

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

describe('PUL-12 — savings_goal_id propagation (RPC integration)', () => {
  it('the atomic wrapper propagates the link, protects adjusted lines, and untags on null', async () => {
    if (!env) return; // skip — no local Supabase

    const userA = await makeUser(`sg-prop-a-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(userA.id);

    const templateId = crypto.randomUUID();
    const templateLineId = crypto.randomUUID();
    const goalId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const autoLineId = crypto.randomUUID();
    const adjustedLineId = crypto.randomUUID();

    // Seed via service role (bypass RLS).
    await admin.from('template').insert({
      id: templateId,
      user_id: userA.id,
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
    });
    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: userA.id,
      name: 'Maison',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });
    await admin.from('monthly_budget').insert({
      id: budgetId,
      user_id: userA.id,
      template_id: templateId,
      month: 1,
      year: 2099,
      description: '',
    });
    await admin.from('budget_line').insert([
      {
        id: autoLineId,
        budget_id: budgetId,
        template_line_id: templateLineId,
        name: 'Épargne',
        amount: 'enc',
        kind: 'saving',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      },
      {
        id: adjustedLineId,
        budget_id: budgetId,
        template_line_id: templateLineId,
        name: 'Épargne (ajustée)',
        amount: 'enc',
        kind: 'saving',
        recurrence: 'fixed',
        is_manually_adjusted: true,
      },
    ]);

    // TAG: update template_line.savings_goal_id with propagation.
    const { error: tagError } = await userA.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [],
        p_updated_lines: [
          { id: templateLineId, savings_goal_id: goalId },
        ] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [] as never,
      },
    );
    expect(tagError).toBeNull();

    const tagged = await admin
      .from('budget_line')
      .select('id, savings_goal_id')
      .in('id', [autoLineId, adjustedLineId]);
    const byId = new Map(
      (tagged.data ?? []).map((r) => [r.id, r.savings_goal_id]),
    );
    expect(byId.get(autoLineId)).toBe(goalId); // propagated
    expect(byId.get(adjustedLineId)).toBeNull(); // adjusted protected

    const templateLine = await admin
      .from('template_line')
      .select('savings_goal_id')
      .eq('id', templateLineId)
      .single();
    expect(templateLine.data?.savings_goal_id).toBe(goalId);

    // UNTAG: savings_goal_id = null.
    const { error: untagError } = await userA.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [],
        p_updated_lines: [
          { id: templateLineId, savings_goal_id: null },
        ] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [] as never,
      },
    );
    expect(untagError).toBeNull();

    const untagged = await admin
      .from('budget_line')
      .select('savings_goal_id')
      .eq('id', autoLineId)
      .single();
    expect(untagged.data?.savings_goal_id).toBeNull();
  });

  it('rolls back template, budget, savings-goal and tag mutations when bulk tag sync fails', async () => {
    if (!env) return;

    const user = await makeUser(
      `sg-atomic-tags-${crypto.randomUUID()}@test.local`,
    );
    const foreignTagOwner = await makeUser(
      `sg-atomic-tags-foreign-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(user.id, foreignTagOwner.id);

    const templateId = crypto.randomUUID();
    const updatedTemplateLineId = crypto.randomUUID();
    const deletedTemplateLineId = crypto.randomUUID();
    const createdTemplateLineId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const updatedBudgetLineId = crypto.randomUUID();
    const deletedBudgetLineId = crypto.randomUUID();
    const originalGoalId = crypto.randomUUID();
    const replacementGoalId = crypto.randomUUID();
    const originalTagId = crypto.randomUUID();
    const replacementTagId = crypto.randomUUID();
    const foreignTagId = crypto.randomUUID();

    await admin.from('template').insert({
      id: templateId,
      user_id: user.id,
      name: 'Atomic template',
      is_default: false,
    });
    await admin.from('savings_goal').insert([
      {
        id: originalGoalId,
        user_id: user.id,
        name: 'Original goal',
        target_amount: 'enc',
        target_date: '2099-01-01',
        status: 'ACTIVE',
      },
      {
        id: replacementGoalId,
        user_id: user.id,
        name: 'Replacement goal',
        target_amount: 'enc',
        target_date: '2099-01-01',
        status: 'ACTIVE',
      },
    ]);
    await admin.from('tag').insert([
      { id: originalTagId, user_id: user.id, name: 'Original tag' },
      { id: replacementTagId, user_id: user.id, name: 'Replacement tag' },
      {
        id: foreignTagId,
        user_id: foreignTagOwner.id,
        name: 'Foreign tag',
      },
    ]);
    await admin.from('template_line').insert([
      {
        id: updatedTemplateLineId,
        template_id: templateId,
        savings_goal_id: originalGoalId,
        name: 'Original update line',
        amount: 'ciphertext-original',
        kind: 'saving',
        recurrence: 'fixed',
      },
      {
        id: deletedTemplateLineId,
        template_id: templateId,
        name: 'Original delete line',
        amount: 'ciphertext-delete',
        kind: 'expense',
        recurrence: 'fixed',
      },
    ]);
    await admin.from('monthly_budget').insert({
      id: budgetId,
      user_id: user.id,
      template_id: templateId,
      month: 8,
      year: 2099,
      description: '',
    });
    await admin.from('budget_line').insert([
      {
        id: updatedBudgetLineId,
        budget_id: budgetId,
        template_line_id: updatedTemplateLineId,
        savings_goal_id: originalGoalId,
        name: 'Original update line',
        amount: 'ciphertext-original',
        kind: 'saving',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      },
      {
        id: deletedBudgetLineId,
        budget_id: budgetId,
        template_line_id: deletedTemplateLineId,
        name: 'Original delete line',
        amount: 'ciphertext-delete',
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      },
    ]);
    await admin.from('template_line_tag').insert({
      template_line_id: updatedTemplateLineId,
      tag_id: originalTagId,
    });
    await admin.from('budget_line_tag').insert({
      budget_line_id: updatedBudgetLineId,
      tag_id: originalTagId,
    });

    const { error } = await user.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [deletedTemplateLineId],
        p_updated_lines: [
          {
            id: updatedTemplateLineId,
            name: 'Mutated update line',
            amount: 'ciphertext-mutated',
            savings_goal_id: replacementGoalId,
          },
        ] as never,
        p_created_lines: [
          {
            id: createdTemplateLineId,
            name: 'Created line',
            amount: 'ciphertext-created',
            kind: 'expense',
            recurrence: 'one_off',
          },
        ] as never,
        p_line_tag_pairs: [
          {
            template_line_id: updatedTemplateLineId,
            tag_ids: [foreignTagId],
          },
        ] as never,
      },
    );
    expect(error).not.toBeNull();

    const templateLinesAfterFailure = await admin
      .from('template_line')
      .select('id, name, amount, savings_goal_id')
      .in('id', [
        updatedTemplateLineId,
        deletedTemplateLineId,
        createdTemplateLineId,
      ]);
    const templateById = new Map(
      (templateLinesAfterFailure.data ?? []).map((line) => [line.id, line]),
    );
    expect(templateById.get(updatedTemplateLineId)).toMatchObject({
      name: 'Original update line',
      amount: 'ciphertext-original',
      savings_goal_id: originalGoalId,
    });
    expect(templateById.has(deletedTemplateLineId)).toBeTrue();
    expect(templateById.has(createdTemplateLineId)).toBeFalse();

    const budgetLinesAfterFailure = await admin
      .from('budget_line')
      .select('id, template_line_id, name, amount, savings_goal_id')
      .eq('budget_id', budgetId);
    const budgetByTemplateLineId = new Map(
      (budgetLinesAfterFailure.data ?? []).map((line) => [
        line.template_line_id,
        line,
      ]),
    );
    expect(budgetByTemplateLineId.get(updatedTemplateLineId)).toMatchObject({
      name: 'Original update line',
      amount: 'ciphertext-original',
      savings_goal_id: originalGoalId,
    });
    expect(budgetByTemplateLineId.has(deletedTemplateLineId)).toBeTrue();
    expect(budgetByTemplateLineId.has(createdTemplateLineId)).toBeFalse();

    const templateTagsAfterFailure = await admin
      .from('template_line_tag')
      .select('tag_id')
      .eq('template_line_id', updatedTemplateLineId);
    const budgetTagsAfterFailure = await admin
      .from('budget_line_tag')
      .select('tag_id')
      .eq('budget_line_id', updatedBudgetLineId);
    expect(templateTagsAfterFailure.data).toEqual([{ tag_id: originalTagId }]);
    expect(budgetTagsAfterFailure.data).toEqual([{ tag_id: originalTagId }]);

    const nominal = await user.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [],
        p_updated_lines: [
          {
            id: updatedTemplateLineId,
            savings_goal_id: replacementGoalId,
          },
        ] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [
          {
            template_line_id: updatedTemplateLineId,
            tag_ids: [replacementTagId],
          },
        ] as never,
      },
    );
    expect(nominal.error).toBeNull();

    const nominalBudgetLine = await admin
      .from('budget_line')
      .select('savings_goal_id')
      .eq('id', updatedBudgetLineId)
      .single();
    const nominalBudgetTags = await admin
      .from('budget_line_tag')
      .select('tag_id')
      .eq('budget_line_id', updatedBudgetLineId);
    expect(nominalBudgetLine.data?.savings_goal_id).toBe(replacementGoalId);
    expect(nominalBudgetTags.data).toEqual([{ tag_id: replacementTagId }]);
  });

  it('PUL-272: cross-tenant budget_id is rejected (guard survives the rewrite)', async () => {
    if (!env) return;

    const attacker = await makeUser(
      `sg-prop-atk-${crypto.randomUUID()}@test.local`,
    );
    const victim = await makeUser(
      `sg-prop-vic-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id, victim.id);

    const atkTemplateId = crypto.randomUUID();
    const atkLineId = crypto.randomUUID();
    const vicBudgetId = crypto.randomUUID();
    const vicTemplateId = crypto.randomUUID();
    const vicTemplateLineId = crypto.randomUUID();
    const vicLineId = crypto.randomUUID();

    const { error: templateSeedError } = await admin.from('template').insert([
      {
        id: atkTemplateId,
        user_id: attacker.id,
        name: 'atk',
        is_default: false,
      },
      { id: vicTemplateId, user_id: victim.id, name: 'vic', is_default: false },
    ]);
    expect(templateSeedError).toBeNull();

    const { error: templateLineSeedError } = await admin
      .from('template_line')
      .insert([
        {
          id: atkLineId,
          template_id: atkTemplateId,
          name: 'x',
          amount: 'enc',
          kind: 'saving',
          recurrence: 'fixed',
        },
        {
          id: vicTemplateLineId,
          template_id: vicTemplateId,
          name: 'victim source line',
          amount: 'enc',
          kind: 'saving',
          recurrence: 'fixed',
        },
      ]);
    expect(templateLineSeedError).toBeNull();

    const { error: budgetSeedError } = await admin
      .from('monthly_budget')
      .insert({
        id: vicBudgetId,
        user_id: victim.id,
        template_id: vicTemplateId,
        month: 2,
        year: 2099,
        description: '',
      });
    expect(budgetSeedError).toBeNull();

    const { error: budgetLineSeedError } = await admin
      .from('budget_line')
      .insert({
        id: vicLineId,
        budget_id: vicBudgetId,
        template_line_id: vicTemplateLineId,
        name: 'victim line',
        amount: 'enc',
        kind: 'saving',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });
    expect(budgetLineSeedError).toBeNull();

    const { error } = await attacker.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: atkTemplateId,
        p_budget_ids: [vicBudgetId], // foreign budget
        p_delete_ids: [],
        p_updated_lines: [
          { id: atkLineId, savings_goal_id: crypto.randomUUID() },
        ] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [] as never,
      },
    );
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toContain('Budget access denied');
  });

  it('rejects a foreign savings_goal_id through the SECURITY DEFINER propagation RPC', async () => {
    if (!env) return;

    const attacker = await makeUser(
      `sg-prop-goal-atk-${crypto.randomUUID()}@test.local`,
    );
    const victim = await makeUser(
      `sg-prop-goal-vic-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id, victim.id);

    const templateId = crypto.randomUUID();
    const templateLineId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const foreignGoalId = crypto.randomUUID();

    await admin.from('template').insert({
      id: templateId,
      user_id: attacker.id,
      name: 'atk',
      is_default: false,
    });
    await admin.from('template_line').insert({
      id: templateLineId,
      template_id: templateId,
      name: 'Épargne',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
    });
    await admin.from('monthly_budget').insert({
      id: budgetId,
      user_id: attacker.id,
      template_id: templateId,
      month: 5,
      year: 2099,
      description: '',
    });
    await admin.from('savings_goal').insert({
      id: foreignGoalId,
      user_id: victim.id,
      name: 'Victim goal',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const { error } = await attacker.client.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [],
        p_updated_lines: [
          { id: templateLineId, savings_goal_id: foreignGoalId },
        ] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [] as never,
      },
    );

    expect(error).not.toBeNull();
    expect(error?.message ?? '').toContain('Savings goal access denied');
  });

  it('create_budget_from_template copies the link into the generated budget', async () => {
    if (!env) return;

    const userA = await makeUser(`sg-gen-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(userA.id);

    const templateId = crypto.randomUUID();
    const templateLineId = crypto.randomUUID();
    const goalId = crypto.randomUUID();

    await admin.from('template').insert({
      id: templateId,
      user_id: userA.id,
      name: 'T',
      is_default: false,
    });
    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: userA.id,
      name: 'Voiture',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
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

    const { error } = await admin.rpc('create_budget_from_template', {
      p_user_id: userA.id,
      p_template_id: templateId,
      p_month: 3,
      p_year: 2099,
      p_description: '',
    });
    expect(error).toBeNull();

    const lines = await admin
      .from('budget_line')
      .select('savings_goal_id, template_line_id')
      .eq('template_line_id', templateLineId);
    expect(lines.data?.length).toBeGreaterThan(0);
    expect(lines.data?.[0]?.savings_goal_id).toBe(goalId);
  });

  it('create_template_with_lines persists an inline savings_goal_id (batch path)', async () => {
    if (!env) return;

    const user = await makeUser(`sg-tpl-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(user.id);

    const goalId = crypto.randomUUID();
    await admin.from('savings_goal').insert({
      id: goalId,
      user_id: user.id,
      name: 'Voiture',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const { data, error } = await user.client.rpc(
      'create_template_with_lines',
      {
        p_user_id: user.id,
        p_name: 'Mois type',
        p_description: '',
        p_is_default: false,
        p_lines: [
          {
            name: 'Épargne',
            amount: 'enc',
            kind: 'saving',
            recurrence: 'fixed',
            savings_goal_id: goalId,
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
    const lines = await admin
      .from('template_line')
      .select('savings_goal_id')
      .eq('template_id', templateId);
    expect(lines.data?.length).toBe(1);
    expect(lines.data?.[0]?.savings_goal_id).toBe(goalId);
  });

  it('create_template_with_lines rejects a foreign savings_goal_id', async () => {
    if (!env) return;

    const attacker = await makeUser(
      `sg-tpl-goal-atk-${crypto.randomUUID()}@test.local`,
    );
    const victim = await makeUser(
      `sg-tpl-goal-vic-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id, victim.id);

    const foreignGoalId = crypto.randomUUID();
    await admin.from('savings_goal').insert({
      id: foreignGoalId,
      user_id: victim.id,
      name: 'Victim goal',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const { error } = await attacker.client.rpc('create_template_with_lines', {
      p_user_id: attacker.id,
      p_name: 'Mois type',
      p_description: '',
      p_is_default: false,
      p_lines: [
        {
          name: 'Épargne',
          amount: 'enc',
          kind: 'saving',
          recurrence: 'fixed',
          savings_goal_id: foreignGoalId,
          description: '',
          original_amount: null,
          original_currency: null,
          target_currency: null,
          exchange_rate: null,
        },
      ] as never,
    });

    expect(error).not.toBeNull();
    expect(error?.message ?? '').toContain('Savings goal access denied');
  });
});
