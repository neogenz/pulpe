/**
 * PUL-18 tag history data path against local Supabase.
 *
 * Amount columns stay opaque (`enc:N`) in Postgres and are decoded only by the
 * repository encryption port. The AES round-trip itself is covered by the
 * encryption integration suite; this suite proves RLS, direct junctions,
 * expense-only filtering, missing periods and multi-tag counting together.
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
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import type { InfoLogger } from '@common/logger';
import { SupabaseTagRepository } from './infrastructure/persistence/supabase-tag.repository';
import { GetTagHistoryUseCase } from './application/get-tag-history.use-case';

const PASSWORD = 'test-password-123';
const encryption = {
  getDekFor: async () => Buffer.alloc(32),
  decryptAmount: (ciphertext: string) => Number(ciphertext.slice(4)),
} as unknown as EncryptionPort;
const logger = {
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
let userA: TestUser;
let userB: TestUser;
const createdUserIds: string[] = [];
const tagAId = crypto.randomUUID();
const secondTagAId = crypto.randomUUID();

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

function historyUseCaseFor(user: TestUser): {
  useCase: GetTagHistoryUseCase;
  authUser: AuthenticatedUser;
} {
  const authUser = {
    id: user.id,
    email: 'history@test.local',
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
  } as AuthenticatedSupabaseProvider;
  const repository = new SupabaseTagRepository(provider, encryption);
  return {
    useCase: new GetTagHistoryUseCase(repository, logger),
    authUser,
  };
}

async function seedHistory(): Promise<void> {
  const templateId = crypto.randomUUID();
  const novemberBudgetId = crypto.randomUUID();
  const januaryBudgetId = crypto.randomUUID();
  const novemberLineId = crypto.randomUUID();
  const incomeLineId = crypto.randomUUID();
  const januaryLineId = crypto.randomUUID();
  const untaggedLineId = crypto.randomUUID();
  const novemberTransactionId = crypto.randomUUID();
  const januaryTransactionId = crypto.randomUUID();
  const savingTransactionId = crypto.randomUUID();

  const { error: templateError } = await admin.from('template').insert({
    id: templateId,
    user_id: userA.id,
    name: 'Historique tags',
    is_default: false,
  });
  if (templateError) throw templateError;

  const { error: tagError } = await admin.from('tag').insert([
    { id: tagAId, user_id: userA.id, name: 'Voyage' },
    { id: secondTagAId, user_id: userA.id, name: 'Long courrier' },
  ]);
  if (tagError) throw tagError;

  const { error: budgetError } = await admin.from('monthly_budget').insert([
    {
      id: novemberBudgetId,
      user_id: userA.id,
      template_id: templateId,
      month: 11,
      year: 2026,
      description: '',
    },
    {
      id: januaryBudgetId,
      user_id: userA.id,
      template_id: templateId,
      month: 1,
      year: 2027,
      description: '',
    },
  ]);
  if (budgetError) throw budgetError;

  const baseLine = {
    recurrence: 'one_off' as const,
    is_manually_adjusted: false,
  };
  const { error: lineError } = await admin.from('budget_line').insert([
    {
      ...baseLine,
      id: novemberLineId,
      budget_id: novemberBudgetId,
      name: 'Train',
      amount: 'enc:100',
      kind: 'expense',
    },
    {
      ...baseLine,
      id: incomeLineId,
      budget_id: novemberBudgetId,
      name: 'Remboursement',
      amount: 'enc:999',
      kind: 'income',
    },
    {
      ...baseLine,
      id: januaryLineId,
      budget_id: januaryBudgetId,
      name: 'Hôtel',
      amount: 'enc:50',
      kind: 'expense',
    },
    {
      ...baseLine,
      id: untaggedLineId,
      budget_id: januaryBudgetId,
      name: 'Non tagué',
      amount: 'enc:888',
      kind: 'expense',
    },
  ]);
  if (lineError) throw lineError;

  const { error: transactionError } = await admin.from('transaction').insert([
    {
      id: novemberTransactionId,
      budget_id: novemberBudgetId,
      name: 'Billet',
      amount: 'enc:75',
      kind: 'expense',
      transaction_date: '2026-11-10',
    },
    {
      id: januaryTransactionId,
      budget_id: januaryBudgetId,
      name: 'Nuit',
      amount: 'enc:200',
      kind: 'expense',
      transaction_date: '2027-01-10',
    },
    {
      id: savingTransactionId,
      budget_id: januaryBudgetId,
      name: 'Épargne',
      amount: 'enc:999',
      kind: 'saving',
      transaction_date: '2027-01-11',
    },
  ]);
  if (transactionError) throw transactionError;

  const { error: lineTagError } = await admin.from('budget_line_tag').insert([
    { budget_line_id: novemberLineId, tag_id: tagAId },
    { budget_line_id: novemberLineId, tag_id: secondTagAId },
    { budget_line_id: incomeLineId, tag_id: tagAId },
    { budget_line_id: januaryLineId, tag_id: tagAId },
  ]);
  if (lineTagError) throw lineTagError;

  const { error: transactionTagError } = await admin
    .from('transaction_tag')
    .insert([
      { transaction_id: novemberTransactionId, tag_id: tagAId },
      { transaction_id: januaryTransactionId, tag_id: tagAId },
      { transaction_id: savingTransactionId, tag_id: tagAId },
    ]);
  if (transactionTagError) throw transactionTagError;
}

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);
  userA = await makeUser(`tag-history-a-${crypto.randomUUID()}@test.local`);
  userB = await makeUser(`tag-history-b-${crypto.randomUUID()}@test.local`);
  await seedHistory();
});

afterAll(async () => {
  if (!env) return;
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
});

describe('PUL-18 tag history data path', () => {
  it('returns decrypted direct expense contributions with a zero-filled gap', async () => {
    if (!env) return;
    const { useCase, authUser } = historyUseCaseFor(userA);

    const history = await useCase.execute(
      tagAId,
      { months: 3, endMonth: 1, endYear: 2027 },
      authUser,
    );

    expect(history.periods).toEqual([
      { month: 11, year: 2026, plannedAmount: 100, actualAmount: 75 },
      { month: 12, year: 2026, plannedAmount: 0, actualAmount: 0 },
      { month: 1, year: 2027, plannedAmount: 50, actualAmount: 200 },
    ]);
    expect(history.totalPlanned).toBe(150);
    expect(history.totalActual).toBe(275);
    expect(history.monthlyAverageActual).toBeCloseTo(275 / 3);
    expect(history.actualToPlannedPercent).toBeCloseTo((275 / 150) * 100);
  });

  it('counts one multi-tag item once in each requested tag history', async () => {
    if (!env) return;
    const { useCase, authUser } = historyUseCaseFor(userA);

    const history = await useCase.execute(
      secondTagAId,
      { months: 3, endMonth: 1, endYear: 2027 },
      authUser,
    );

    expect(history.totalPlanned).toBe(100);
    expect(history.totalActual).toBe(0);
  });

  it('returns TAG_NOT_FOUND without reading a foreign tag history', async () => {
    if (!env) return;
    const { useCase, authUser } = historyUseCaseFor(userB);

    await expect(
      useCase.execute(
        tagAId,
        { months: 3, endMonth: 1, endYear: 2027 },
        authUser,
      ),
    ).rejects.toMatchObject({ code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code });
  });
});
