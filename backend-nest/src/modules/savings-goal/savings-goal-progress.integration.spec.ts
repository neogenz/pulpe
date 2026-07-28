/**
 * PUL-8 — savings-goal progress DATA-PATH on the real local Postgres.
 *
 * The 9 formulas are unit-tested in shared/src/calculators/savings-goal-progress.spec.ts;
 * this suite proves the SERVER WIRING those formulas depend on against real RLS:
 *   - the budget_line → monthly_budget!inner join scopes to the owner and the goal,
 *     so plannedCumulative counts only linked, in-period lines (a future-period line
 *     and a same-period unlinked saving line are both excluded);
 *   - the transaction follow-up query feeds the checked envelope into `confirmed`;
 *   - a foreign user reading another user's goal id gets SAVINGS_GOAL_NOT_FOUND
 *     (RLS hides the row at findById), and never sees the foreign contributions.
 *
 * Encryption is stubbed (`enc:N` → N) exactly like the sibling repo specs — the
 * crypto round-trip lives in encryption.integration.spec.ts; here the amounts are
 * opaque ciphertext columns and only the data path matters.
 *
 * Skips cleanly when local Supabase is unreachable (throws only on the dedicated
 * RUN_INTEGRATION_TESTS run, so that job never passes vacuously).
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import type { InfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { CacheService } from '@modules/cache/cache.service';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';
import { GetSavingsGoalProgressUseCase } from './application/get-savings-goal-progress.use-case';
import { UpdateSavingsGoalUseCase } from './application/update-savings-goal.use-case';
import { SupabaseBudgetTemplateRepository } from '@modules/budget-template/infrastructure/persistence/supabase-budget-template.repository';

const PASSWORD = 'test-password-123';

// Stubs shared across every use-case instance below.
const encryptionStub = {
  getDekFor: async () => Buffer.alloc(32),
  encryptAmount: (amount: number) => `enc:${amount}`,
  tryDecryptAmount: (cipher: string | null, _dek: Buffer, fallback: number) =>
    typeof cipher === 'string' && cipher.startsWith('enc:')
      ? Number(cipher.slice(4))
      : fallback,
} as unknown as EncryptionPort;

const noopLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  trace: () => {},
} as unknown as InfoLogger;

interface TestUser {
  id: string;
  client: SupabaseClient<Database>;
}

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
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

/** Real repository + real use-case running under the user's own JWT (RLS live). */
function progressUseCaseFor(
  user: TestUser,
  payDayOfMonth?: number,
): {
  useCase: GetSavingsGoalProgressUseCase;
  updateUseCase: UpdateSavingsGoalUseCase;
  authUser: AuthenticatedUser;
} {
  const authUser = {
    id: user.id,
    email: 'x@test.local',
    accessToken: 'token',
    clientKey: Buffer.alloc(32),
    payDayOfMonth,
  } as unknown as AuthenticatedUser;
  const provider = {
    get client() {
      return user.client as unknown as AuthenticatedSupabaseClient;
    },
    get user() {
      return authUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
  const repo = new SupabaseSavingsGoalRepository(provider, encryptionStub);
  const templateRepo = new SupabaseBudgetTemplateRepository(
    provider,
    encryptionStub,
    noopLogger,
  );
  return {
    useCase: new GetSavingsGoalProgressUseCase(repo, templateRepo, noopLogger),
    updateUseCase: new UpdateSavingsGoalUseCase(
      repo,
      { recalculate: async () => {} } as BudgetRecalculationPort,
      { invalidateForUser: async () => {} } as unknown as CacheService,
      noopLogger,
    ),
    authUser,
  };
}

interface Period {
  month: number;
  year: number;
}

// payDay is unset for these fresh users → calendar-month periods.
const nowPeriod: Period = (() => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
})();

function shiftPeriod(period: Period, delta: number): Period {
  const zeroBased = period.year * 12 + (period.month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

const pastPeriod = shiftPeriod(nowPeriod, -1);
const futurePeriod = shiftPeriod(nowPeriod, 1);
const dateOfPeriod = (period: Period): string =>
  `${period.year}-${String(period.month).padStart(2, '0')}-01`;

const goalAId = crypto.randomUUID();
const goalBId = crypto.randomUUID();
let userA: TestUser;
let userB: TestUser;

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);

  userA = await makeUser(`sg-progress-a-${crypto.randomUUID()}@test.local`);
  userB = await makeUser(`sg-progress-b-${crypto.randomUUID()}@test.local`);

  const templateAId = crypto.randomUUID();
  const pastBudgetId = crypto.randomUUID();
  const currentBudgetId = crypto.randomUUID();
  const futureBudgetId = crypto.randomUUID();
  // budget_line.id has no DB default — every seeded row needs an explicit id.
  const pastLineId = crypto.randomUUID();
  const currentLineId = crypto.randomUUID();
  const futureLineId = crypto.randomUUID();
  const unlinkedLineId = crypto.randomUUID();

  await admin.from('savings_goal').insert({
    id: goalAId,
    user_id: userA.id,
    name: 'Maison',
    target_amount: 'enc:1000',
    target_date: '2099-12-01',
    status: 'ACTIVE',
    created_at: `${dateOfPeriod(pastPeriod)}T00:00:00.000Z`,
  });
  await admin.from('template').insert({
    id: templateAId,
    user_id: userA.id,
    name: 'T',
    is_default: false,
  });
  await admin.from('monthly_budget').insert([
    {
      id: pastBudgetId,
      user_id: userA.id,
      template_id: templateAId,
      month: pastPeriod.month,
      year: pastPeriod.year,
      description: '',
    },
    {
      id: currentBudgetId,
      user_id: userA.id,
      template_id: templateAId,
      month: nowPeriod.month,
      year: nowPeriod.year,
      description: '',
    },
    {
      id: futureBudgetId,
      user_id: userA.id,
      template_id: templateAId,
      month: futurePeriod.month,
      year: futurePeriod.year,
      description: '',
    },
  ]);
  await admin.from('budget_line').insert([
    // Past, linked, checked → counts in plannedCumulative + confirmed envelope.
    {
      id: pastLineId,
      budget_id: pastBudgetId,
      name: 'Épargne (passé)',
      amount: 'enc:200',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
      checked_at: '2026-01-15T00:00:00Z',
    },
    // Current, linked, unchecked → counts in plannedCumulative; confirmed via its tx.
    {
      id: currentLineId,
      budget_id: currentBudgetId,
      name: 'Épargne (courant)',
      amount: 'enc:300',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
    },
    // Future, linked → excluded from plannedCumulative (period > current).
    {
      id: futureLineId,
      budget_id: futureBudgetId,
      name: 'Épargne (futur)',
      amount: 'enc:999',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
    },
    // Same-period saving line NOT linked to the goal → must never count.
    {
      id: unlinkedLineId,
      budget_id: currentBudgetId,
      name: 'Épargne libre',
      amount: 'enc:5000',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: null,
      checked_at: '2026-01-15T00:00:00Z',
    },
  ]);
  // Allocated, checked saving transaction on the current unchecked line → +150.
  await admin.from('transaction').insert({
    budget_id: currentBudgetId,
    budget_line_id: currentLineId,
    name: 'Versement',
    amount: 'enc:150',
    kind: 'saving',
    checked_at: '2026-01-20T00:00:00Z',
  });

  // User B owns a separate goal + linked line — must stay invisible to A.
  const templateBId = crypto.randomUUID();
  const budgetBId = crypto.randomUUID();
  await admin.from('savings_goal').insert({
    id: goalBId,
    user_id: userB.id,
    name: 'Privé B',
    target_amount: 'enc:2000',
    target_date: '2099-12-01',
    status: 'ACTIVE',
  });
  await admin.from('template').insert({
    id: templateBId,
    user_id: userB.id,
    name: 'TB',
    is_default: false,
  });
  await admin.from('monthly_budget').insert({
    id: budgetBId,
    user_id: userB.id,
    template_id: templateBId,
    month: nowPeriod.month,
    year: nowPeriod.year,
    description: '',
  });
  await admin.from('budget_line').insert({
    id: crypto.randomUUID(),
    budget_id: budgetBId,
    name: 'Épargne B',
    amount: 'enc:7777',
    kind: 'saving',
    recurrence: 'fixed',
    is_manually_adjusted: false,
    savings_goal_id: goalBId,
    checked_at: '2026-01-15T00:00:00Z',
  });
});

afterAll(async () => {
  if (!env) return;
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
});

describe('PUL-8 — savings-goal progress data path (local Supabase)', () => {
  it('aggregates only the owner’s linked, in-period contributions', async () => {
    if (!env) return;

    const { useCase, authUser } = progressUseCaseFor(userA);
    const { goal, computed } = await useCase.execute(goalAId, authUser);

    expect(goal.targetAmount).toBe(1000); // findById decrypt path
    // 200 (past) + 300 (current); the 999 future line and the 5000 unlinked line drop out.
    expect(computed.plannedCumulative).toBe(500);
    // past checked envelope max(200, 0) + current line consumed 150.
    expect(computed.confirmed).toBe(350);
    // Exactly the three lines tagged with the goal — unlinked + foreign excluded.
    expect(computed.linkedLineCount).toBe(3);
  });

  it('changes interval metadata without rewriting linked forecasts', async () => {
    if (!env) return;

    const { useCase, updateUseCase, authUser } = progressUseCaseFor(userA);
    const before = await userA.client
      .from('budget_line')
      .select('id, amount, savings_goal_id')
      .eq('savings_goal_id', goalAId)
      .order('id');
    expect(before.error).toBeNull();

    await updateUseCase.execute(
      goalAId,
      {
        startDate: dateOfPeriod(nowPeriod),
        targetAmount: null,
        targetDate: null,
      },
      authUser,
    );
    const openGoal = await useCase.execute(goalAId, authUser);
    expect(openGoal.goal.targetAmount).toBeNull();
    expect(openGoal.goal.targetDate).toBeNull();
    expect(openGoal.computed.plannedCumulative).toBe(300);
    expect(openGoal.computed.achievementPercent).toBeNull();

    await updateUseCase.execute(
      goalAId,
      { targetAmount: 2000, targetDate: '2099-12-01' },
      authUser,
    );
    const datedGoal = await useCase.execute(goalAId, authUser);
    expect(datedGoal.goal.targetAmount).toBe(2000);
    expect(datedGoal.goal.targetDate).toBe('2099-12-01');
    expect(datedGoal.computed.plannedCumulative).toBe(300);

    const after = await userA.client
      .from('budget_line')
      .select('id, amount, savings_goal_id')
      .eq('savings_goal_id', goalAId)
      .order('id');
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it('updates an earlier date in the same payDay-aware cycle without reconciliation', async () => {
    if (!env) return;

    const { updateUseCase, authUser } = progressUseCaseFor(userA, 25);
    const previousCalendarMonth = shiftPeriod(nowPeriod, -1);
    const originalDate = `${dateOfPeriod(nowPeriod).slice(0, 8)}15`;
    const earlierSameCycleDate = `${dateOfPeriod(previousCalendarMonth).slice(0, 8)}26`;
    const before = await userA.client
      .from('budget_line')
      .select('id, amount, savings_goal_id')
      .eq('savings_goal_id', goalAId)
      .order('id');
    expect(before.error).toBeNull();

    await updateUseCase.execute(
      goalAId,
      { startDate: null, targetDate: null },
      authUser,
    );
    await updateUseCase.execute(
      goalAId,
      { targetDate: originalDate },
      authUser,
    );
    const updated = await updateUseCase.execute(
      goalAId,
      { targetDate: earlierSameCycleDate },
      authUser,
    );

    expect(updated.targetDate).toBe(earlierSameCycleDate);
    const after = await userA.client
      .from('budget_line')
      .select('id, amount, savings_goal_id')
      .eq('savings_goal_id', goalAId)
      .order('id');
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it('hides a foreign user’s goal — NOT_FOUND, no contribution leak', async () => {
    if (!env) return;

    const { useCase, authUser } = progressUseCaseFor(userB);

    let caught: unknown;
    try {
      await useCase.execute(goalAId, authUser);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
    );
  });
});
