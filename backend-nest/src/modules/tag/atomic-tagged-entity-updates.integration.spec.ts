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
import type { Database, Json } from '@/types/database.types';

const PASSWORD = 'test-password-123';
const templateId = crypto.randomUUID();
const budgetId = crypto.randomUUID();
const transactionId = crypto.randomUUID();
const budgetLineId = crypto.randomUUID();
const templateLineId = crypto.randomUUID();
const originalTagId = crypto.randomUUID();
const replacementTagId = crypto.randomUUID();
const foreignTagId = crypto.randomUUID();

type EntityKind = 'transaction' | 'budget_line' | 'template_line';

interface TestUser {
  id: string;
  client: SupabaseClient<Database>;
}

const entities: { kind: EntityKind; id: string }[] = [
  { kind: 'transaction', id: transactionId },
  { kind: 'budget_line', id: budgetLineId },
  { kind: 'template_line', id: templateLineId },
];

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
let owner: TestUser;
let other: TestUser;
const createdUserIds: string[] = [];

async function makeUser(email: string): Promise<TestUser> {
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
  createdUserIds.push(data.user.id);
  return { id: data.user.id, client };
}

async function callUpdate(
  client: SupabaseClient<Database>,
  entity: { kind: EntityKind; id: string },
  patch: Json,
  tagIds: string[],
) {
  if (entity.kind === 'transaction') {
    return client.rpc('update_transaction_with_tags', {
      p_transaction_id: entity.id,
      p_patch: patch,
      p_tag_ids: tagIds,
    });
  }
  if (entity.kind === 'budget_line') {
    return client.rpc('update_budget_line_with_tags', {
      p_budget_line_id: entity.id,
      p_patch: patch,
      p_tag_ids: tagIds,
    });
  }
  return client.rpc('update_template_line_with_tags', {
    p_template_line_id: entity.id,
    p_patch: patch,
    p_tag_ids: tagIds,
  });
}

async function readName(entity: { kind: EntityKind; id: string }) {
  if (entity.kind === 'transaction') {
    return admin
      .from('transaction')
      .select('name')
      .eq('id', entity.id)
      .single();
  }
  if (entity.kind === 'budget_line') {
    return admin
      .from('budget_line')
      .select('name')
      .eq('id', entity.id)
      .single();
  }
  return admin
    .from('template_line')
    .select('name')
    .eq('id', entity.id)
    .single();
}

async function readTagIds(entity: { kind: EntityKind; id: string }) {
  if (entity.kind === 'transaction') {
    const { data, error } = await admin
      .from('transaction_tag')
      .select('tag_id')
      .eq('transaction_id', entity.id);
    return { tagIds: (data ?? []).map((row) => row.tag_id), error };
  }
  if (entity.kind === 'budget_line') {
    const { data, error } = await admin
      .from('budget_line_tag')
      .select('tag_id')
      .eq('budget_line_id', entity.id);
    return { tagIds: (data ?? []).map((row) => row.tag_id), error };
  }
  const { data, error } = await admin
    .from('template_line_tag')
    .select('tag_id')
    .eq('template_line_id', entity.id);
  return { tagIds: (data ?? []).map((row) => row.tag_id), error };
}

async function resetEntity(entity: { kind: EntityKind; id: string }) {
  if (entity.kind === 'transaction') {
    await admin
      .from('transaction')
      .update({ name: 'Original' })
      .eq('id', entity.id);
    await admin
      .from('transaction_tag')
      .delete()
      .eq('transaction_id', entity.id);
    await admin
      .from('transaction_tag')
      .insert({ transaction_id: entity.id, tag_id: originalTagId });
    return;
  }
  if (entity.kind === 'budget_line') {
    await admin
      .from('budget_line')
      .update({ name: 'Original' })
      .eq('id', entity.id);
    await admin
      .from('budget_line_tag')
      .delete()
      .eq('budget_line_id', entity.id);
    await admin
      .from('budget_line_tag')
      .insert({ budget_line_id: entity.id, tag_id: originalTagId });
    return;
  }
  await admin
    .from('template_line')
    .update({ name: 'Original' })
    .eq('id', entity.id);
  await admin
    .from('template_line_tag')
    .delete()
    .eq('template_line_id', entity.id);
  await admin
    .from('template_line_tag')
    .insert({ template_line_id: entity.id, tag_id: originalTagId });
}

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);
  owner = await makeUser(`atomic-tags-owner-${crypto.randomUUID()}@test.local`);
  other = await makeUser(`atomic-tags-other-${crypto.randomUUID()}@test.local`);

  const { error: templateError } = await admin.from('template').insert({
    id: templateId,
    user_id: owner.id,
    name: 'Atomic tags',
    is_default: false,
  });
  if (templateError) throw templateError;

  const { error: tagError } = await admin.from('tag').insert([
    { id: originalTagId, user_id: owner.id, name: 'Original' },
    { id: replacementTagId, user_id: owner.id, name: 'Replacement' },
    { id: foreignTagId, user_id: other.id, name: 'Foreign' },
  ]);
  if (tagError) throw tagError;

  const { error: budgetError } = await admin.from('monthly_budget').insert({
    id: budgetId,
    user_id: owner.id,
    template_id: templateId,
    month: 7,
    year: 2026,
    description: '',
  });
  if (budgetError) throw budgetError;

  const { error: entityError } = await admin.from('transaction').insert({
    id: transactionId,
    budget_id: budgetId,
    name: 'Original',
    amount: 'ciphertext',
    kind: 'expense',
    transaction_date: '2026-07-15',
  });
  if (entityError) throw entityError;
  const { error: budgetLineError } = await admin.from('budget_line').insert({
    id: budgetLineId,
    budget_id: budgetId,
    name: 'Original',
    amount: 'ciphertext',
    kind: 'expense',
    recurrence: 'one_off',
  });
  if (budgetLineError) throw budgetLineError;
  const { error: templateLineError } = await admin
    .from('template_line')
    .insert({
      id: templateLineId,
      template_id: templateId,
      name: 'Original',
      amount: 'ciphertext',
      kind: 'expense',
      recurrence: 'one_off',
    });
  if (templateLineError) throw templateLineError;
});

beforeEach(async () => {
  if (!env) return;
  for (const entity of entities) await resetEntity(entity);
});

afterAll(async () => {
  if (!env) return;
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
});

describe('PUL-18 atomic tagged entity updates', () => {
  it('rolls back tags on scalar errors and scalars on tag errors', async () => {
    if (!env) return;

    for (const entity of entities) {
      const scalarFailure = await callUpdate(
        owner.client,
        entity,
        { name: null },
        [replacementTagId],
      );
      expect(scalarFailure.error?.code).toBe('23502');
      expect((await readName(entity)).data?.name).toBe('Original');
      expect((await readTagIds(entity)).tagIds).toEqual([originalTagId]);

      const tagFailure = await callUpdate(
        owner.client,
        entity,
        { name: 'Partially updated' },
        [crypto.randomUUID()],
      );
      expect(tagFailure.error).not.toBeNull();
      expect((await readName(entity)).data?.name).toBe('Original');
      expect((await readTagIds(entity)).tagIds).toEqual([originalTagId]);
    }
  });

  it('returns each updated row after a successful mixed patch', async () => {
    if (!env) return;

    for (const entity of entities) {
      const result = await callUpdate(
        owner.client,
        entity,
        { name: 'Accepted' },
        [replacementTagId],
      );
      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({ id: entity.id, name: 'Accepted' });
      expect((await readTagIds(entity)).tagIds).toEqual([replacementTagId]);
    }
  });

  it('does not reveal or mutate another tenant parent', async () => {
    if (!env) return;

    for (const entity of entities) {
      const result = await callUpdate(
        other.client,
        entity,
        { name: 'Foreign mutation' },
        [foreignTagId],
      );
      expect(result.error?.code).toBe('P0001');
      expect(result.error?.message).toContain('not found');
      expect((await readName(entity)).data?.name).toBe('Original');
      expect((await readTagIds(entity)).tagIds).toEqual([originalTagId]);
    }
  });
});
