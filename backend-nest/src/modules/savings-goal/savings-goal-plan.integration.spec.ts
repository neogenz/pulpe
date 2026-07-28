/**
 * PUL-12 — savings-goal plan READ timeline + WRITE apply on the real local Postgres.
 *
 * The timeline/simulation formulas are unit-tested in shared
 * (savings-goal-plan.spec.ts); the RPC guards are pinned in
 * apply-savings-goal-plan.rpc.spec.ts. This suite proves the SERVER WIRING against
 * real RLS + the SECURITY DEFINER `apply_savings_goal_plan` RPC:
 *   - progress `months[]` covers ancrage → cible with gap months, monotonic
 *     cumulatives and a locked past month;
 *   - a foreign user applying to another user's goal gets SAVINGS_GOAL_NOT_FOUND
 *     (RLS hides the goal at findById) — nothing is written;
 *   - a checked or past-period line in the batch RAISEs and rolls back the WHOLE
 *     transaction (the sibling valid line stays untouched — nothing partial);
 *   - only linked, non-checked, current-or-future saving lines are updated;
 *   - the touched budgets are handed to the recalculation port exactly once each;
 *   - a retried apply lands the same final state (UPDATE-by-value idempotency);
 *
 * Encryption is stubbed (`enc:N` ↔ N) exactly like the sibling repo specs.
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
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { BudgetLineSpreadPort } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import type { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';
import { GetSavingsGoalProgressUseCase } from './application/get-savings-goal-progress.use-case';
import { ApplySavingsGoalPlanUseCase } from './application/apply-savings-goal-plan.use-case';
import { SupabaseBudgetTemplateRepository } from '@modules/budget-template/infrastructure/persistence/supabase-budget-template.repository';

const PASSWORD = 'test-password-123';

const decodeEnc = (cipher: string | null, fallback: number): number =>
  typeof cipher === 'string' && cipher.startsWith('enc:')
    ? Number(cipher.slice(4))
    : fallback;

// Full stub: read decrypts `enc:N`, write encrypts N → `enc:N` (stored as-is).
const encryptionStub = {
  getDekFor: async () => Buffer.alloc(32),
  tryDecryptAmount: (cipher: string | null, _dek: Buffer, fallback: number) =>
    decodeEnc(cipher, fallback),
  prepareAmountData: async (amount: number) => ({ amount: `enc:${amount}` }),
  decryptRowAmountFields: (
    row: { amount: string | null; original_amount: string | null },
    _dek: Buffer,
  ) => ({
    ...row,
    amount: decodeEnc(row.amount, 0),
    original_amount:
      row.original_amount === null ? null : decodeEnc(row.original_amount, 0),
  }),
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

function authUserFor(user: TestUser): AuthenticatedUser {
  return {
    id: user.id,
    email: 'x@test.local',
    accessToken: 'token',
    clientKey: Buffer.alloc(32),
  } as unknown as AuthenticatedUser;
}

function providerFor(
  user: TestUser,
  authUser: AuthenticatedUser,
): AuthenticatedSupabaseProvider {
  return {
    get client() {
      return user.client as unknown as AuthenticatedSupabaseClient;
    },
    get user() {
      return authUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

function progressUseCaseFor(user: TestUser): {
  useCase: GetSavingsGoalProgressUseCase;
  authUser: AuthenticatedUser;
} {
  const authUser = authUserFor(user);
  const repo = new SupabaseSavingsGoalRepository(
    providerFor(user, authUser),
    encryptionStub,
  );
  const templateRepo = new SupabaseBudgetTemplateRepository(
    providerFor(user, authUser),
    encryptionStub,
    noopLogger,
  );
  return {
    useCase: new GetSavingsGoalProgressUseCase(repo, templateRepo, noopLogger),
    authUser,
  };
}

function applyPlanUseCaseFor(user: TestUser): {
  useCase: ApplySavingsGoalPlanUseCase;
  authUser: AuthenticatedUser;
  recalcCalls: string[];
} {
  const authUser = authUserFor(user);
  const repo = new SupabaseSavingsGoalRepository(
    providerFor(user, authUser),
    encryptionStub,
  );
  const recalcCalls: string[] = [];
  const recalcPort = {
    recalculate: async (budgetId: string) => {
      recalcCalls.push(budgetId);
    },
  } as unknown as BudgetRecalculationPort;
  const cacheStub = {
    invalidateForUser: async () => {},
  } as unknown as CacheService;
  const spreadStub = {
    fanOut: async () => ({
      spreadGroupId: 'spread-group',
      lines: [],
      createdBudgets: [],
      skippedMonths: [],
    }),
  } as unknown as BudgetLineSpreadPort;
  return {
    useCase: new ApplySavingsGoalPlanUseCase(
      repo,
      recalcPort,
      spreadStub,
      cacheStub,
      noopLogger,
    ),
    authUser,
    recalcCalls,
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
const future1Period = shiftPeriod(nowPeriod, 1);
const targetPeriod = shiftPeriod(nowPeriod, 3); // leaves nowPeriod+2 and +3 as gaps

const goalAId = crypto.randomUUID();
const templateAId = crypto.randomUUID();
const templateLineAId = crypto.randomUUID();

const pastBudgetId = crypto.randomUUID();
const currentBudgetId = crypto.randomUUID();
const futureBudgetId = crypto.randomUUID();

const currentLineId = crypto.randomUUID(); // current, unchecked, linked
const futureLineId = crypto.randomUUID(); // future, unchecked, linked
const checkedLineId = crypto.randomUUID(); // current, CHECKED, linked
const pastLineId = crypto.randomUUID(); // past, unchecked, linked
const unlinkedLineId = crypto.randomUUID(); // current, saving, NOT linked
const idemLineId = crypto.randomUUID(); // current, unchecked, linked

let userA: TestUser;
let userB: TestUser;

async function amountOf(lineId: string): Promise<number> {
  const { data } = await admin
    .from('budget_line')
    .select('amount')
    .eq('id', lineId)
    .single();
  return decodeEnc(data?.amount ?? null, Number.NaN);
}

async function flagOf(lineId: string): Promise<boolean> {
  const { data } = await admin
    .from('budget_line')
    .select('is_manually_adjusted')
    .eq('id', lineId)
    .single();
  return Boolean(data?.is_manually_adjusted);
}

const targetDateIso = `${targetPeriod.year}-${String(targetPeriod.month).padStart(2, '0')}-01`;
const createdAtIso = `${pastPeriod.year}-${String(pastPeriod.month).padStart(2, '0')}-01T00:00:00.000Z`;

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);

  userA = await makeUser(`sg-plan-a-${crypto.randomUUID()}@test.local`);
  userB = await makeUser(`sg-plan-b-${crypto.randomUUID()}@test.local`);

  await admin.from('savings_goal').insert({
    id: goalAId,
    user_id: userA.id,
    name: 'Maison',
    target_amount: 'enc:10000',
    target_date: targetDateIso,
    status: 'ACTIVE',
    created_at: createdAtIso,
  });
  await admin.from('template').insert({
    id: templateAId,
    user_id: userA.id,
    name: 'T',
    is_default: false,
  });
  await admin.from('template_line').insert({
    id: templateLineAId,
    template_id: templateAId,
    name: 'Épargne Mois Type',
    amount: 'enc:250',
    kind: 'saving',
    recurrence: 'fixed',
    savings_goal_id: goalAId,
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
      month: future1Period.month,
      year: future1Period.year,
      description: '',
    },
  ]);
  await admin.from('budget_line').insert([
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
    {
      id: futureLineId,
      budget_id: futureBudgetId,
      name: 'Épargne (futur)',
      amount: 'enc:400',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
    },
    {
      id: checkedLineId,
      budget_id: currentBudgetId,
      name: 'Épargne (pointée)',
      amount: 'enc:100',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
      checked_at: '2026-01-20T00:00:00Z',
    },
    {
      id: pastLineId,
      budget_id: pastBudgetId,
      name: 'Épargne (passé)',
      amount: 'enc:200',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
    },
    {
      id: unlinkedLineId,
      budget_id: currentBudgetId,
      name: 'Épargne libre',
      amount: 'enc:5000',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: null,
    },
    {
      id: idemLineId,
      budget_id: currentBudgetId,
      name: 'Épargne (idempotence)',
      amount: 'enc:500',
      kind: 'saving',
      recurrence: 'fixed',
      is_manually_adjusted: false,
      savings_goal_id: goalAId,
    },
  ]);
});

afterAll(async () => {
  if (!env) return;
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
});

describe('PUL-12 — plan timeline (read) on local Supabase', () => {
  it('builds months ancrage → cible with a gap month, locked past, monotonic cumulatives', async () => {
    if (!env) return;

    const { useCase, authUser } = progressUseCaseFor(userA);
    const { computed, months } = await useCase.execute(goalAId, authUser);

    // The persisted creation period makes the historical anchor explicit.
    expect(months.length).toBeGreaterThanOrEqual(5);

    const past = months.find(
      (m) => m.month === pastPeriod.month && m.year === pastPeriod.year,
    );
    const current = months.find(
      (m) => m.month === nowPeriod.month && m.year === nowPeriod.year,
    );
    const target = months.find(
      (m) => m.month === targetPeriod.month && m.year === targetPeriod.year,
    );

    expect(past?.isLocked).toBe(true); // strictly-past cycle
    expect(past?.state).toBe('past');
    expect(current?.state).toBe('current');
    // nowPeriod+2 and +3 have no budget/line → gap rows keep the curve continuous.
    expect(months.some((m) => m.state === 'gap')).toBe(true);
    expect(target?.state).toBe('gap');

    // Cumulatives never decrease across the timeline.
    for (let i = 1; i < months.length; i++) {
      expect(months[i].plannedCumulative).toBeGreaterThanOrEqual(
        months[i - 1].plannedCumulative,
      );
      expect(months[i].confirmedCumulative).toBeGreaterThanOrEqual(
        months[i - 1].confirmedCumulative,
      );
    }

    // Progress plannedCumulative sums the linked lines in the ≤ current window:
    // past 200 + current (300 + 100 checked + 500 idem) = 1100. The future 400
    // and the unlinked 5000 are excluded.
    expect(computed.plannedCumulative).toBe(1100);
    expect(current?.lines.some((l) => l.budgetLineId === currentLineId)).toBe(
      true,
    );
  });
});

describe('PUL-12 — plan apply (write) on local Supabase', () => {
  it('updates linked current+future lines, flags them, recalculates touched budgets', async () => {
    if (!env) return;

    const { useCase, authUser, recalcCalls } = applyPlanUseCaseFor(userA);
    const result = await useCase.execute(
      goalAId,
      {
        monthAdjustments: [
          { budgetLineId: currentLineId, amount: 450 },
          { budgetLineId: futureLineId, amount: 350 },
        ],
      },
      authUser,
    );

    expect(result.updatedLines).toHaveLength(2);
    // Both touched budgets recalculated exactly once, no duplicates.
    expect(new Set(recalcCalls)).toEqual(
      new Set([currentBudgetId, futureBudgetId]),
    );
    expect(recalcCalls).toHaveLength(2);

    expect(await amountOf(currentLineId)).toBe(450);
    expect(await amountOf(futureLineId)).toBe(350);
    expect(await flagOf(currentLineId)).toBe(true); // is_manually_adjusted flipped
    expect(await flagOf(futureLineId)).toBe(true);

    // The plan writer no longer mutates the Mois Type.
    const { data: tpl } = await admin
      .from('template_line')
      .select('amount')
      .eq('id', templateLineAId)
      .single();
    expect(decodeEnc(tpl?.amount ?? null, Number.NaN)).toBe(250);
  });

  it('rejects a checked line and rolls back the whole batch (nothing partial)', async () => {
    if (!env) return;

    const { useCase, authUser } = applyPlanUseCaseFor(userA);
    let caught: unknown;
    try {
      await useCase.execute(
        goalAId,
        {
          monthAdjustments: [
            { budgetLineId: currentLineId, amount: 111 }, // valid
            { budgetLineId: checkedLineId, amount: 111 }, // pointé → RAISE
          ],
        },
        authUser,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_CONFLICT.code,
    );
    // Rollback proof: the sibling valid line keeps its previous value (450), NOT 111.
    expect(await amountOf(currentLineId)).toBe(450);
    expect(await amountOf(checkedLineId)).toBe(100);
  });

  it('rejects an unchecked line whose cycle is in the past (409 conflict)', async () => {
    if (!env) return;

    const { useCase, authUser } = applyPlanUseCaseFor(userA);
    let caught: unknown;
    try {
      await useCase.execute(
        goalAId,
        {
          monthAdjustments: [{ budgetLineId: pastLineId, amount: 123 }],
        },
        authUser,
      );
    } catch (error) {
      caught = error;
    }

    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_CONFLICT.code,
    );
    expect(await amountOf(pastLineId)).toBe(200);
  });

  it('rejects a saving line not linked to the goal (422)', async () => {
    if (!env) return;

    const { useCase, authUser } = applyPlanUseCaseFor(userA);
    let caught: unknown;
    try {
      await useCase.execute(
        goalAId,
        {
          monthAdjustments: [{ budgetLineId: unlinkedLineId, amount: 123 }],
        },
        authUser,
      );
    } catch (error) {
      caught = error;
    }

    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_LINE_INVALID.code,
    );
    expect(await amountOf(unlinkedLineId)).toBe(5000);
  });

  it('hides a foreign goal — NOT_FOUND, nothing written', async () => {
    if (!env) return;

    const { useCase, authUser } = applyPlanUseCaseFor(userB);
    let caught: unknown;
    try {
      await useCase.execute(
        goalAId,
        {
          monthAdjustments: [{ budgetLineId: currentLineId, amount: 999 }],
        },
        authUser,
      );
    } catch (error) {
      caught = error;
    }

    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
    );
    // userA's line is untouched (still 450 from the happy-path test).
    expect(await amountOf(currentLineId)).toBe(450);
  });

  it('is idempotent: applying the same plan twice lands the same state', async () => {
    if (!env) return;

    const run = async () => {
      const { useCase, authUser, recalcCalls } = applyPlanUseCaseFor(userA);
      const result = await useCase.execute(
        goalAId,
        {
          monthAdjustments: [{ budgetLineId: idemLineId, amount: 600 }],
        },
        authUser,
      );
      return { result, recalcCalls };
    };

    const first = await run();
    const second = await run();

    expect(first.result.updatedLines).toHaveLength(1);
    expect(second.result.updatedLines).toHaveLength(1);
    expect(first.recalcCalls).toEqual([currentBudgetId]);
    expect(second.recalcCalls).toEqual([currentBudgetId]);
    // Final state identical after the retry — UPDATE-by-value.
    expect(await amountOf(idemLineId)).toBe(600);
    expect(await flagOf(idemLineId)).toBe(true);
  });
});
