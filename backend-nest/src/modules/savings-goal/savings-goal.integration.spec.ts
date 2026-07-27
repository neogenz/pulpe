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

interface DeletionSeed {
  user: { id: string; client: SupabaseClient<Database> };
  goalId: string;
  templateLineId: string;
  budgetIds: string[];
  budgetLineIds: string[];
  transactionId: string;
}

interface DeletionImpactPayload {
  budgets: unknown[];
  revision: Database['public']['Functions']['apply_savings_goal_deletion']['Args']['p_revision'];
}

async function seedDeletionImpact(budgetCount = 1): Promise<DeletionSeed> {
  const user = await makeUser(`sg-impact-${crypto.randomUUID()}@test.local`);
  createdUserIds.push(user.id);
  const goalId = crypto.randomUUID();
  const templateId = crypto.randomUUID();
  const templateLineId = crypto.randomUUID();
  const budgetIds = Array.from({ length: budgetCount }, () =>
    crypto.randomUUID(),
  );
  const budgetLineIds = Array.from({ length: budgetCount }, () =>
    crypto.randomUUID(),
  );
  const transactionId = crypto.randomUUID();

  const inserts = await Promise.all([
    admin.from('savings_goal').insert({
      id: goalId,
      user_id: user.id,
      name: 'Maison',
      target_amount: 'enc:10000',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    }),
    admin.from('template').insert({
      id: templateId,
      user_id: user.id,
      name: 'Mois Type',
      is_default: true,
    }),
  ]);
  for (const result of inserts) expect(result.error).toBeNull();

  const templateLine = await admin.from('template_line').insert({
    id: templateLineId,
    template_id: templateId,
    name: 'Épargne maison',
    amount: 'enc:100',
    kind: 'saving',
    recurrence: 'fixed',
    savings_goal_id: goalId,
  });
  expect(templateLine.error).toBeNull();

  const budgets = await admin.from('monthly_budget').insert(
    budgetIds.map((id, index) => ({
      id,
      user_id: user.id,
      template_id: templateId,
      month: (index % 12) + 1,
      year: 2090 + Math.floor(index / 12),
      description: '',
    })),
  );
  expect(budgets.error).toBeNull();

  const lines = await admin.from('budget_line').insert(
    budgetLineIds.map((id, index) => ({
      id,
      budget_id: budgetIds[index],
      template_line_id: templateLineId,
      name: `Épargne ${index + 1}`,
      amount: 'enc:100',
      kind: 'saving' as const,
      recurrence: 'fixed' as const,
      is_manually_adjusted: false,
      savings_goal_id: goalId,
    })),
  );
  expect(lines.error).toBeNull();

  const transaction = await admin.from('transaction').insert({
    id: transactionId,
    budget_id: budgetIds[0],
    budget_line_id: budgetLineIds[0],
    name: 'Virement',
    amount: 'enc:50',
    kind: 'saving',
    transaction_date: '2090-01-05T00:00:00Z',
  });
  expect(transaction.error).toBeNull();

  return {
    user,
    goalId,
    templateLineId,
    budgetIds,
    budgetLineIds,
    transactionId,
  };
}

async function getDeletionImpact(
  seed: DeletionSeed,
): Promise<DeletionImpactPayload> {
  const { data, error } = await seed.user.client.rpc(
    'get_savings_goal_deletion_impact',
    { p_goal_id: seed.goalId },
  );
  expect(error).toBeNull();
  if (!data) throw new Error('Deletion impact missing');
  return data as unknown as DeletionImpactPayload;
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

  it('CA7: foreign goals cannot be linked to owned template or budget lines', async () => {
    if (!env) return;

    const owner = await makeUser(
      `sg-link-own-${crypto.randomUUID()}@test.local`,
    );
    const other = await makeUser(
      `sg-link-oth-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(owner.id, other.id);

    const templateId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const foreignGoalId = crypto.randomUUID();

    await admin.from('template').insert({
      id: templateId,
      user_id: owner.id,
      name: 'Owner template',
      is_default: false,
    });
    await admin.from('monthly_budget').insert({
      id: budgetId,
      user_id: owner.id,
      template_id: templateId,
      month: 4,
      year: 2099,
      description: '',
    });
    await admin.from('savings_goal').insert({
      id: foreignGoalId,
      user_id: other.id,
      name: 'Foreign goal',
      target_amount: 'enc',
      target_date: '2099-01-01',
      status: 'ACTIVE',
    });

    const templateLine = await owner.client.from('template_line').insert({
      template_id: templateId,
      name: 'Épargne étrangère',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: foreignGoalId,
      description: '',
    });
    expect(templateLine.error).not.toBeNull();

    const budgetLine = await owner.client.from('budget_line').insert({
      budget_id: budgetId,
      name: 'Épargne étrangère',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: foreignGoalId,
    });
    expect(budgetLine.error).not.toBeNull();
  });

  it.each([
    ['goal_only', true, true, true, null],
    ['goal_and_forecasts', false, false, true, null],
    ['goal_forecasts_and_transactions', false, false, false, null],
  ] as const)(
    'PUL-319: %s applies the exact deletion scope',
    async (
      mode,
      keepsTemplateLine,
      keepsBudgetLine,
      keepsTransaction,
      expectedGoalLink,
    ) => {
      if (!env) return;
      const seed = await seedDeletionImpact();
      const impact = await getDeletionImpact(seed);

      const { data, error } = await seed.user.client.rpc(
        'apply_savings_goal_deletion',
        {
          p_goal_id: seed.goalId,
          p_mode: mode,
          p_revision: impact.revision,
        },
      );

      expect(error).toBeNull();
      expect(data?.length).toBe(mode === 'goal_only' ? 0 : 1);

      const [goal, templateLine, budgetLine, transaction] = await Promise.all([
        admin.from('savings_goal').select('id').eq('id', seed.goalId),
        admin
          .from('template_line')
          .select('id, savings_goal_id')
          .eq('id', seed.templateLineId),
        admin
          .from('budget_line')
          .select('id, savings_goal_id')
          .eq('id', seed.budgetLineIds[0]),
        admin
          .from('transaction')
          .select('id, budget_line_id')
          .eq('id', seed.transactionId),
      ]);

      expect(goal.data).toHaveLength(0);
      expect(templateLine.data).toHaveLength(keepsTemplateLine ? 1 : 0);
      expect(budgetLine.data).toHaveLength(keepsBudgetLine ? 1 : 0);
      if (keepsTemplateLine) {
        expect(templateLine.data?.[0]?.savings_goal_id).toBe(expectedGoalLink);
      }
      if (keepsBudgetLine) {
        expect(budgetLine.data?.[0]?.savings_goal_id).toBe(expectedGoalLink);
      }
      expect(transaction.data).toHaveLength(keepsTransaction ? 1 : 0);
      if (keepsTransaction) {
        expect(transaction.data?.[0]?.budget_line_id).toBe(
          keepsBudgetLine ? seed.budgetLineIds[0] : null,
        );
      }
    },
  );

  it('PUL-319: rejects a stale preview and rolls back every mutation', async () => {
    if (!env) return;
    const seed = await seedDeletionImpact();
    const impact = await getDeletionImpact(seed);

    const changed = await admin
      .from('budget_line')
      .update({ name: 'Épargne modifiée' })
      .eq('id', seed.budgetLineIds[0]);
    expect(changed.error).toBeNull();

    const { error } = await seed.user.client.rpc(
      'apply_savings_goal_deletion',
      {
        p_goal_id: seed.goalId,
        p_mode: 'goal_forecasts_and_transactions',
        p_revision: impact.revision,
      },
    );

    expect(error?.message ?? '').toContain(
      'Savings goal deletion impact changed',
    );
    const [goal, lines, transactions] = await Promise.all([
      admin.from('savings_goal').select('id').eq('id', seed.goalId),
      admin
        .from('budget_line')
        .select('id, savings_goal_id')
        .in('id', seed.budgetLineIds),
      admin
        .from('transaction')
        .select('id, budget_line_id')
        .eq('id', seed.transactionId),
    ]);
    expect(goal.data).toHaveLength(1);
    expect(lines.data).toHaveLength(1);
    expect(lines.data?.[0]?.savings_goal_id).toBe(seed.goalId);
    expect(transactions.data).toHaveLength(1);
    expect(transactions.data?.[0]?.budget_line_id).toBe(seed.budgetLineIds[0]);
  });

  it('PUL-319: hides preview and mutation from another user', async () => {
    if (!env) return;
    const seed = await seedDeletionImpact();
    const attacker = await makeUser(
      `sg-impact-attacker-${crypto.randomUUID()}@test.local`,
    );
    createdUserIds.push(attacker.id);
    const impact = await getDeletionImpact(seed);

    const preview = await attacker.client.rpc(
      'get_savings_goal_deletion_impact',
      { p_goal_id: seed.goalId },
    );
    expect(preview.error?.message ?? '').toContain(
      'Savings goal access denied',
    );

    const deletion = await attacker.client.rpc('apply_savings_goal_deletion', {
      p_goal_id: seed.goalId,
      p_mode: 'goal_only',
      p_revision: impact.revision,
    });
    expect(deletion.error?.message ?? '').toContain(
      'Savings goal access denied',
    );
  });

  it('PUL-319: previews and removes all lines across 76 budgets', async () => {
    if (!env) return;
    const seed = await seedDeletionImpact(76);
    const impact = await getDeletionImpact(seed);

    expect(impact.budgets).toHaveLength(76);
    const { data, error } = await seed.user.client.rpc(
      'apply_savings_goal_deletion',
      {
        p_goal_id: seed.goalId,
        p_mode: 'goal_and_forecasts',
        p_revision: impact.revision,
      },
    );

    expect(error).toBeNull();
    expect(data).toHaveLength(76);
    const remaining = await admin
      .from('budget_line')
      .select('id')
      .in('id', seed.budgetLineIds);
    expect(remaining.data).toHaveLength(0);
  });
});
