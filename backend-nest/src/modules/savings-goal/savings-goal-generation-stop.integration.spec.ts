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
import { Buffer } from 'node:buffer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { CacheService } from '@modules/cache/cache.service';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { UpdateSavingsGoalUseCase } from './application/update-savings-goal.use-case';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';

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

function updateUseCaseFor(user: SeededGoal['user']): {
  useCase: UpdateSavingsGoalUseCase;
  repo: SupabaseSavingsGoalRepository;
  authUser: AuthenticatedUser;
} {
  const authUser = {
    id: user.id,
    email: 'x@test.local',
    accessToken: 'token',
    clientKey: Buffer.alloc(32),
  } as AuthenticatedUser;
  const provider = {
    get client() {
      return user.client as unknown as AuthenticatedSupabaseClient;
    },
    get user() {
      return authUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
  const encryption = {
    getDekFor: async () => Buffer.alloc(32),
    tryDecryptAmount: (
      ciphertext: string | null,
      _dek: Buffer,
      fallback: number | null,
    ) =>
      typeof ciphertext === 'string' && ciphertext.startsWith('enc:')
        ? Number(ciphertext.slice(4))
        : fallback,
  } as unknown as EncryptionPort;
  const repo = new SupabaseSavingsGoalRepository(provider, encryption);
  const logger = { info: () => {} } as unknown as InfoLogger;
  return {
    useCase: new UpdateSavingsGoalUseCase(
      repo,
      { recalculate: async () => {} } as BudgetRecalculationPort,
      { invalidateForUser: async () => {} } as unknown as CacheService,
      logger,
    ),
    repo,
    authUser,
  };
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
  const targetDate = '2099-06-15';
  const expectedTargetDate = '2099-12-01';

  it('freezes the exact post-deadline candidates and patches the goal atomically', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([4, 6, 7, 8]);
    const metadataUpdate = await admin.auth.admin.updateUserById(seed.user.id, {
      user_metadata: { payDayOfMonth: 27 },
    });
    expect(metadataUpdate.error).toBeNull();
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
        p_expected_target_date: expectedTargetDate,
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
        p_expected_target_date: expectedTargetDate,
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
        p_expected_target_date: expectedTargetDate,
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

  it('serializes an empty-preview deadline advance in both commit orders through the use case', async () => {
    if (!env) return;

    const linkFirst = await seedGoalWithBudgets([7]);
    const linkFirstUseCase = updateUseCaseFor(linkFirst.user);
    const findLinkedSavingLines =
      linkFirstUseCase.repo.findLinkedSavingLines.bind(linkFirstUseCase.repo);
    let releasePreview!: () => void;
    const previewReleased = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    let previewRead!: () => void;
    const previewWasRead = new Promise<void>((resolve) => {
      previewRead = resolve;
    });
    linkFirstUseCase.repo.findLinkedSavingLines = async (goalId) => {
      const lines = await findLinkedSavingLines(goalId);
      previewRead();
      await previewReleased;
      return lines;
    };

    const advanceAfterPreview = linkFirstUseCase.useCase.execute(
      linkFirst.goalId,
      { targetDate },
      linkFirstUseCase.authUser,
    );
    await previewWasRead;
    const concurrentLineId = crypto.randomUUID();
    const linkBeforeRpc = await admin.from('budget_line').insert({
      id: concurrentLineId,
      budget_id: linkFirst.budgetIdByMonth.get(7)!,
      name: 'Épargne concurrente',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: linkFirst.goalId,
    });
    expect(linkBeforeRpc.error).toBeNull();
    releasePreview();
    await expect(advanceAfterPreview).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_RECONCILIATION_CONFLICT',
    });

    const unchangedGoal = await admin
      .from('savings_goal')
      .select('target_date')
      .eq('id', linkFirst.goalId)
      .single();
    expect(unchangedGoal.data?.target_date).toBe(expectedTargetDate);

    const deadlineFirst = await seedGoalWithBudgets([7]);
    const deadlineFirstUseCase = updateUseCaseFor(deadlineFirst.user);
    await deadlineFirstUseCase.useCase.execute(
      deadlineFirst.goalId,
      { targetDate },
      deadlineFirstUseCase.authUser,
    );
    const linkAfterRpc = await admin.from('budget_line').insert({
      id: crypto.randomUUID(),
      budget_id: deadlineFirst.budgetIdByMonth.get(7)!,
      name: 'Épargne trop tardive',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: deadlineFirst.goalId,
    });
    expect(linkAfterRpc.error?.message ?? '').toContain(
      'Savings goal line outside target horizon',
    );
  });

  it('orders an ordinary open-to-dated patch before a later link', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([7]);
    await admin
      .from('savings_goal')
      .update({ target_date: null })
      .eq('id', seed.goalId);
    const { useCase, authUser } = updateUseCaseFor(seed.user);

    await useCase.execute(seed.goalId, { targetDate }, authUser);
    const lateLink = await admin.from('budget_line').insert({
      id: crypto.randomUUID(),
      budget_id: seed.budgetIdByMonth.get(7)!,
      name: 'Épargne après datation',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: seed.goalId,
    });

    expect(lateLink.error?.message ?? '').toContain(
      'Savings goal line outside target horizon',
    );
  });

  it('enforces the horizon only when a budget-line link changes', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([6, 7]);
    const existingLateLine = await seedLinkedLine(seed, 7);
    const { error: targetUpdateError } = await admin
      .from('savings_goal')
      .update({ target_date: '2099-06-01' })
      .eq('id', seed.goalId);
    expect(targetUpdateError).toBeNull();

    const inHorizonLine = await seedLinkedLine(seed, 6);
    const inHorizon = await admin
      .from('budget_line')
      .select('id')
      .eq('id', inHorizonLine)
      .single();
    expect(inHorizon.data?.id).toBe(inHorizonLine);

    const { error: lateInsertError } = await admin.from('budget_line').insert({
      id: crypto.randomUUID(),
      budget_id: seed.budgetIdByMonth.get(7)!,
      name: 'Épargne tardive',
      amount: 'enc',
      kind: 'saving',
      recurrence: 'fixed',
      savings_goal_id: seed.goalId,
    });
    expect(lateInsertError?.message ?? '').toContain(
      'Savings goal line outside target horizon',
    );

    const { error: historicalUpdateError } = await admin
      .from('budget_line')
      .update({
        amount: 'enc-updated',
        savings_goal_id: seed.goalId,
      })
      .eq('id', existingLateLine);
    expect(historicalUpdateError).toBeNull();
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
          p_expected_target_date: expectedTargetDate,
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
        p_expected_target_date: expectedTargetDate,
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

  it('rejects a stale expected deadline before changing the goal or its lines', async () => {
    if (!env) return;

    const seed = await seedGoalWithBudgets([7]);
    const candidate = await seedLinkedLine(seed, 7);

    const { error } = await seed.user.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: seed.goalId,
        p_mode: 'remove',
        p_budget_line_ids: [candidate],
        p_expected_target_date: '2099-11-01',
        p_patch: { target_date: targetDate },
      } as never,
    );

    expect(error?.message ?? '').toContain(
      'Savings goal reconciliation conflict',
    );
    const line = await admin
      .from('budget_line')
      .select('savings_goal_id')
      .eq('id', candidate)
      .single();
    expect(line.data?.savings_goal_id).toBe(seed.goalId);
    const goal = await admin
      .from('savings_goal')
      .select('target_date')
      .eq('id', seed.goalId)
      .single();
    expect(goal.data?.target_date).toBe('2099-12-01');
  });
});
