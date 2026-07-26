/**
 * PUL-12 — savings_goal DB behaviour on the real local Postgres.
 *   - CA5: deleting a goal unlinks tagged budget_line + template_line rows
 *     (savings_goal_id -> null) via FK ON DELETE SET NULL; no prévision deleted.
 *   - CA7: RLS isolates savings_goal by user_id (a foreign user cannot read it).
 *
 * Skips cleanly when local Supabase is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBudgetPeriodForDate, savingsGoalCreateSchema } from 'pulpe-shared';
import {
  ensureSupabaseAvailable,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';
import type { BudgetLineSpreadPort } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import { SupabaseBudgetRepository } from '@modules/budget/infrastructure/persistence/supabase-budget.repository';
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BulkTemplateLineOperationsUseCase } from '@modules/budget-template/application/bulk-template-line-operations.use-case';
import { TemplateLinePropagationAdapter } from '@modules/budget-template/infrastructure/adapters/template-line-propagation.adapter';
import { SupabaseBudgetTemplateRepository } from '@modules/budget-template/infrastructure/persistence/supabase-budget-template.repository';
import type { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { CreateSavingsGoalUseCase } from './application/create-savings-goal.use-case';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';

const PASSWORD = 'test-password-123';

const decodeEnc = (
  cipher: string | null,
  fallback: number | null,
): number | null =>
  typeof cipher === 'string' && cipher.startsWith('enc:')
    ? Number(cipher.slice(4))
    : fallback;

const encryptionStub = {
  ensureUserDEK: async () => Buffer.alloc(32),
  getDekFor: async () => Buffer.alloc(32),
  encryptAmount: (amount: number) => `enc:${amount}`,
  encryptOptionalAmount: async (amount: number | null | undefined) =>
    amount == null ? null : `enc:${amount}`,
  prepareAmountData: async (amount: number) => ({ amount: `enc:${amount}` }),
  prepareAmountsData: async (amounts: number[]) =>
    amounts.map((amount) => ({ amount: `enc:${amount}` })),
  tryDecryptAmount: (
    cipher: string | null,
    _dek: Buffer,
    fallback: number | null,
  ) => decodeEnc(cipher, fallback),
} as unknown as EncryptionPort;

const noopLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  trace: () => {},
} as unknown as InfoLogger;

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

function createUseCaseFor(user: {
  id: string;
  client: SupabaseClient<Database>;
}): {
  useCase: CreateSavingsGoalUseCase;
  authUser: AuthenticatedUser;
  spreadCalls: unknown[][];
  recalculatedBudgetIds: string[];
} {
  const authUser = {
    id: user.id,
    email: 'x@test.local',
    accessToken: 'token',
    clientKey: Buffer.alloc(32),
    payDayOfMonth: null,
  } as AuthenticatedUser;
  const provider = {
    get client() {
      return user.client as unknown as AuthenticatedSupabaseClient;
    },
    get user() {
      return authUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
  const savingsGoalRepo = new SupabaseSavingsGoalRepository(
    provider,
    encryptionStub,
  );
  const templateRepo = new SupabaseBudgetTemplateRepository(
    provider,
    encryptionStub,
    noopLogger,
  );
  const budgetRepo = new SupabaseBudgetRepository(provider, encryptionStub);
  const spreadCalls: unknown[][] = [];
  const spread = {
    fanOut: async (...args: unknown[]) => {
      spreadCalls.push(args);
      return {
        spreadGroupId: 'unexpected-spread',
        lines: [],
        createdBudgets: [],
        skippedMonths: [],
      };
    },
  } as unknown as BudgetLineSpreadPort;
  const recalculatedBudgetIds: string[] = [];
  const recalculation = {
    recalculate: async (budgetId: string) => {
      recalculatedBudgetIds.push(budgetId);
    },
  } as BudgetRecalculationPort;
  const cache = {
    invalidateForUser: async () => {},
  } as unknown as CacheService;
  const bulkOperations = new BulkTemplateLineOperationsUseCase(
    templateRepo,
    new CurrencyService(noopLogger),
    cache,
    recalculation,
    budgetRepo,
    noopLogger,
  );
  const propagation = new TemplateLinePropagationAdapter(bulkOperations);

  return {
    useCase: new CreateSavingsGoalUseCase(
      savingsGoalRepo,
      spread,
      templateRepo,
      propagation,
      noopLogger,
    ),
    authUser,
    spreadCalls,
    recalculatedBudgetIds,
  };
}

function shiftPeriod(
  period: { month: number; year: number },
  delta: number,
): { month: number; year: number } {
  const index = period.year * 12 + period.month - 1 + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
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
  it('wires name-only and undated recurring creation through the real repositories', async () => {
    if (!env) return;

    const user = await makeUser(`sg-create-${crypto.randomUUID()}@test.local`);
    createdUserIds.push(user.id);

    const templateId = crypto.randomUUID();
    const currentPeriod = getBudgetPeriodForDate(new Date(), null);
    const pastPeriod = shiftPeriod(currentPeriod, -1);
    const futurePeriod = shiftPeriod(currentPeriod, 1);
    const pastBudgetId = crypto.randomUUID();
    const currentBudgetId = crypto.randomUUID();
    const futureBudgetId = crypto.randomUUID();

    const templateInsert = await admin.from('template').insert({
      id: templateId,
      user_id: user.id,
      name: 'Mois type',
      is_default: true,
    });
    expect(templateInsert.error).toBeNull();
    const budgetsInsert = await admin.from('monthly_budget').insert([
      {
        id: pastBudgetId,
        user_id: user.id,
        template_id: templateId,
        ...pastPeriod,
        description: '',
      },
      {
        id: currentBudgetId,
        user_id: user.id,
        template_id: templateId,
        ...currentPeriod,
        description: '',
      },
      {
        id: futureBudgetId,
        user_id: user.id,
        template_id: templateId,
        ...futurePeriod,
        description: '',
      },
    ]);
    expect(budgetsInsert.error).toBeNull();

    const harness = createUseCaseFor(user);
    const nameOnly = await harness.useCase.execute(
      savingsGoalCreateSchema.parse({ name: 'Matelas' }),
      harness.authUser,
    );

    const nameOnlyTemplateLines = await user.client
      .from('template_line')
      .select('id')
      .eq('savings_goal_id', nameOnly.id);
    const nameOnlyBudgetLines = await user.client
      .from('budget_line')
      .select('id')
      .eq('savings_goal_id', nameOnly.id);
    expect(nameOnlyTemplateLines.error).toBeNull();
    expect(nameOnlyTemplateLines.data).toEqual([]);
    expect(nameOnlyBudgetLines.error).toBeNull();
    expect(nameOnlyBudgetLines.data).toEqual([]);

    const recurring = await harness.useCase.execute(
      savingsGoalCreateSchema.parse({
        name: 'Voyage',
        monthlyContribution: 250,
      }),
      harness.authUser,
    );

    const templateLines = await user.client
      .from('template_line')
      .select('id, template_id, savings_goal_id, kind, recurrence')
      .eq('savings_goal_id', recurring.id);
    expect(templateLines.error).toBeNull();
    expect(templateLines.data).toHaveLength(1);
    expect(templateLines.data?.[0]).toMatchObject({
      template_id: templateId,
      savings_goal_id: recurring.id,
      kind: 'saving',
      recurrence: 'fixed',
    });

    const budgetLines = await user.client
      .from('budget_line')
      .select('budget_id, template_line_id, savings_goal_id, kind, recurrence')
      .eq('savings_goal_id', recurring.id);
    expect(budgetLines.error).toBeNull();
    expect(budgetLines.data?.map((line) => line.budget_id).sort()).toEqual(
      [currentBudgetId, futureBudgetId].sort(),
    );
    expect(
      budgetLines.data?.every(
        (line) =>
          line.template_line_id === templateLines.data?.[0]?.id &&
          line.kind === 'saving' &&
          line.recurrence === 'fixed',
      ),
    ).toBe(true);
    expect(
      budgetLines.data?.some((line) => line.budget_id === pastBudgetId),
    ).toBe(false);
    expect(harness.spreadCalls).toEqual([]);
    expect(harness.recalculatedBudgetIds.sort()).toEqual(
      [currentBudgetId, futureBudgetId].sort(),
    );
  });

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
});
