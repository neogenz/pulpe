import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { throwIfAssetLinkRefused } from '@common/utils/asset-link';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';

/**
 * `enforce_asset_line_link` raises the messages `asset-link.ts` matches on, so
 * each test drives a real refusal through PostgREST and feeds the error it
 * returns to `throwIfAssetLinkRefused`. The rows are written as the owner,
 * under RLS, the way the repositories write them.
 */

const PASSWORD = 'test-password-123';
const templateId = crypto.randomUUID();
const budgetId = crypto.randomUUID();
const savingLineId = crypto.randomUUID();
const savingsAssetId = crypto.randomUUID();
const debtAssetId = crypto.randomUUID();
const foreignAssetId = crypto.randomUUID();

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
let owner: SupabaseClient<Database>;
const createdUserIds: string[] = [];

async function makeUser(label: string) {
  const email = `${label}-${crypto.randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  createdUserIds.push(data.user.id);
  const client = createClient<Database>(env!.apiUrl, env!.anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
}

async function insertAsset(
  id: string,
  userId: string,
  direction: 'own' | 'owe',
) {
  const categoryId = crypto.randomUUID();
  const category = await admin
    .from('asset_category')
    .insert({ id: categoryId, user_id: userId, name: id.slice(0, 8) });
  if (category.error) throw category.error;
  const asset = await admin.from('asset').insert({
    id,
    user_id: userId,
    category_id: categoryId,
    name: `Asset ${direction}`,
    currency: 'CHF',
    direction,
  });
  if (asset.error) throw asset.error;
}

function refusalOf(error: unknown): BusinessException {
  try {
    throwIfAssetLinkRefused(error, { operation: 'integration' });
  } catch (thrown) {
    return thrown as BusinessException;
  }
  throw new Error(`error not recognised as an asset refusal: ${error}`);
}

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);

  const ownerUser = await makeUser('asset-link-owner');
  owner = ownerUser.client;
  const other = await makeUser('asset-link-other');

  await insertAsset(savingsAssetId, ownerUser.id, 'own');
  await insertAsset(debtAssetId, ownerUser.id, 'owe');
  await insertAsset(foreignAssetId, other.id, 'own');

  for (const step of [
    () =>
      admin.from('template').insert({
        id: templateId,
        user_id: ownerUser.id,
        name: 'Asset link',
        is_default: false,
      }),
    () =>
      admin.from('monthly_budget').insert({
        id: budgetId,
        user_id: ownerUser.id,
        template_id: templateId,
        month: 7,
        year: 2026,
        description: '',
      }),
    () =>
      admin.from('budget_line').insert({
        id: savingLineId,
        budget_id: budgetId,
        name: 'Épargne mensuelle',
        amount: 'ciphertext',
        kind: 'saving',
        recurrence: 'fixed',
        asset_id: savingsAssetId,
      }),
  ]) {
    const { error } = await step();
    if (error) throw new Error(`fixture: ${error.message}`);
  }
});

afterAll(async () => {
  if (!env) return;
  await admin.from('monthly_budget').delete().eq('id', budgetId);
  await admin.from('template').delete().eq('id', templateId);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
});

describe('prévision asset link refusals', () => {
  it('maps a saving linked to a debt to a 400, and writes nothing', async () => {
    if (!env) return;
    const { error } = await owner
      .from('budget_line')
      .update({ asset_id: debtAssetId })
      .eq('id', savingLineId)
      .select()
      .single();

    expect(refusalOf(error).getStatus()).toBe(400);
    const { data } = await admin
      .from('budget_line')
      .select('asset_id')
      .eq('id', savingLineId)
      .single();
    expect(data?.asset_id).toBe(savingsAssetId);
  });

  it("maps another user's asset to a 404 ERR_ASSET_NOT_FOUND on a plain insert", async () => {
    if (!env) return;
    const { error } = await owner.from('budget_line').insert({
      budget_id: budgetId,
      name: 'Pirate',
      amount: 'ciphertext',
      kind: 'saving',
      recurrence: 'fixed',
      asset_id: foreignAssetId,
    });

    const refusal = refusalOf(error);
    expect(refusal.getStatus()).toBe(404);
    expect(refusal.code).toBe('ERR_ASSET_NOT_FOUND');
  });

  it("maps another user's asset to a 404 through update_budget_line_with_tags", async () => {
    if (!env) return;
    const { error } = await owner.rpc('update_budget_line_with_tags', {
      p_budget_line_id: savingLineId,
      p_patch: { asset_id: foreignAssetId },
      p_tag_ids: [],
    });

    expect(refusalOf(error).code).toBe('ERR_ASSET_NOT_FOUND');
  });

  it('keeps the prévision and clears the link when the asset is deleted', async () => {
    if (!env) return;
    const { error: deleteError } = await admin
      .from('asset')
      .delete()
      .eq('id', savingsAssetId);
    expect(deleteError).toBeNull();

    const { data } = await admin
      .from('budget_line')
      .select('id, asset_id')
      .eq('id', savingLineId)
      .single();
    expect(data).toEqual({ id: savingLineId, asset_id: null });
  });
});
