import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';

/**
 * An allocated movement keeps its forecast's kind whichever path changes the
 * forecast. The trigger `align_allocated_transaction_kind` holds the rule, so
 * each test drives one of the statements a path ends in:
 *  - a plain `budget_line` update: PATCH /budget-lines/:id without tags (web,
 *    iOS, Android), MCP update_forecast, reset from the template;
 *  - `update_budget_line_with_tags`: the same edits when they carry tags;
 *  - `apply_template_line_operations_with_tags`: Mois Type propagation.
 */

const PASSWORD = 'test-password-123';
const templateId = crypto.randomUUID();
const templateLineId = crypto.randomUUID();
const budgetId = crypto.randomUUID();
const lineId = crypto.randomUUID();
const otherLineId = crypto.randomUUID();
const allocatedIds = [crypto.randomUUID(), crypto.randomUUID()];
const freeId = crypto.randomUUID();
const otherAllocatedId = crypto.randomUUID();

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
let owner: SupabaseClient<Database>;
let ownerId: string;

async function kindsById(ids: string[]) {
  const { data, error } = await admin
    .from('transaction')
    .select('id, kind')
    .in('id', ids);
  if (error) throw error;
  return new Map(data.map((row) => [row.id, row.kind]));
}

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);

  const email = `kind-alignment-${crypto.randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  ownerId = data.user.id;
  owner = createClient<Database>(env.apiUrl, env.anonKey);
  const { error: signInError } = await owner.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  const steps = [
    () =>
      admin.from('template').insert({
        id: templateId,
        user_id: ownerId,
        name: 'Kind alignment',
        is_default: false,
      }),
    () =>
      admin.from('template_line').insert({
        id: templateLineId,
        template_id: templateId,
        name: 'Courses',
        amount: 'ciphertext',
        kind: 'expense',
        recurrence: 'fixed',
      }),
    () =>
      admin.from('monthly_budget').insert({
        id: budgetId,
        user_id: ownerId,
        template_id: templateId,
        month: 7,
        year: 2026,
        description: '',
      }),
    () =>
      admin.from('budget_line').insert([
        {
          id: lineId,
          budget_id: budgetId,
          template_line_id: templateLineId,
          name: 'Courses',
          amount: 'ciphertext',
          kind: 'expense',
          recurrence: 'fixed',
        },
        {
          id: otherLineId,
          budget_id: budgetId,
          name: 'Loyer',
          amount: 'ciphertext',
          kind: 'expense',
          recurrence: 'fixed',
        },
      ]),
    () =>
      admin.from('transaction').insert([
        ...allocatedIds.map((id) => ({
          id,
          budget_id: budgetId,
          budget_line_id: lineId,
          name: 'Migros',
          amount: 'ciphertext',
          kind: 'expense' as const,
          transaction_date: '2026-07-15',
        })),
        {
          id: freeId,
          budget_id: budgetId,
          name: 'Libre',
          amount: 'ciphertext',
          kind: 'expense',
          transaction_date: '2026-07-15',
        },
        {
          id: otherAllocatedId,
          budget_id: budgetId,
          budget_line_id: otherLineId,
          name: 'Régie',
          amount: 'ciphertext',
          kind: 'expense',
          transaction_date: '2026-07-15',
        },
      ]),
  ];
  for (const step of steps) {
    const { error: stepError } = await step();
    if (stepError) throw stepError;
  }
});

beforeEach(async () => {
  if (!env) return;
  const resets = [
    () =>
      admin
        .from('template_line')
        .update({ kind: 'expense' })
        .eq('id', templateLineId),
    () =>
      admin
        .from('budget_line')
        .update({ kind: 'expense', is_manually_adjusted: false })
        .in('id', [lineId, otherLineId]),
    () =>
      admin
        .from('transaction')
        .update({ kind: 'expense' })
        .in('id', [...allocatedIds, freeId, otherAllocatedId]),
  ];
  for (const reset of resets) {
    const { error } = await reset();
    if (error) throw error;
  }
});

afterAll(async () => {
  if (!env) return;
  await admin.auth.admin.deleteUser(ownerId);
});

describe('allocated movements follow their forecast kind', () => {
  it('re-kinds them when the forecast row is updated directly', async () => {
    if (!env) return;

    const { error } = await owner
      .from('budget_line')
      .update({ kind: 'saving' })
      .eq('id', lineId);
    expect(error).toBeNull();

    const kinds = await kindsById([...allocatedIds, freeId, otherAllocatedId]);
    expect(allocatedIds.map((id) => kinds.get(id))).toEqual([
      'saving',
      'saving',
    ]);
    expect(kinds.get(freeId)).toBe('expense');
    expect(kinds.get(otherAllocatedId)).toBe('expense');
  });

  it('re-kinds them when the forecast is updated with its tags', async () => {
    if (!env) return;

    const { error } = await owner.rpc('update_budget_line_with_tags', {
      p_budget_line_id: lineId,
      p_patch: { kind: 'income' },
      p_tag_ids: [],
    });
    expect(error).toBeNull();

    const kinds = await kindsById(allocatedIds);
    expect([...kinds.values()]).toEqual(['income', 'income']);
  });

  it('re-kinds them when the Mois Type propagates a kind change', async () => {
    if (!env) return;

    const { error } = await owner.rpc(
      'apply_template_line_operations_with_tags',
      {
        p_template_id: templateId,
        p_budget_ids: [budgetId],
        p_delete_ids: [],
        p_updated_lines: [{ id: templateLineId, kind: 'income' }] as never,
        p_created_lines: [] as never,
        p_line_tag_pairs: [] as never,
      },
    );
    expect(error).toBeNull();

    const { data: line } = await admin
      .from('budget_line')
      .select('kind')
      .eq('id', lineId)
      .single();
    expect(line?.kind).toBe('income');
    const kinds = await kindsById([...allocatedIds, otherAllocatedId]);
    expect(allocatedIds.map((id) => kinds.get(id))).toEqual([
      'income',
      'income',
    ]);
    expect(kinds.get(otherAllocatedId)).toBe('expense');
  });
});
