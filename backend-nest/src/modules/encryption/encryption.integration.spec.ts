import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { delimiter, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { EncryptionService } from './encryption.service';
import { EncryptionBackfillService } from './encryption-backfill.service';
import { EncryptionRekeyService } from './encryption-rekey.service';

const BACKEND_ROOT = resolve(__dirname, '../../..');

const TEST_MASTER_KEY = '11'.repeat(32);
const OLD_CLIENT_KEY_HEX = 'aa'.repeat(32);
const NEW_CLIENT_KEY_HEX = 'bb'.repeat(32);
const RECOVERED_CLIENT_KEY_HEX = 'cc'.repeat(32);

type SupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_SUPABASE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

class TestConfigService {
  constructor(private readonly values: Record<string, string>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T;
  }
}

function stripNodeModulesBin(
  pathValue: string | undefined,
): string | undefined {
  if (!pathValue) return pathValue;
  return pathValue
    .split(delimiter)
    .filter((segment) => !segment.includes('node_modules/.bin'))
    .join(delimiter);
}

function resolveSupabaseCliPath(): string {
  if (process.env.SUPABASE_CLI_PATH) {
    return process.env.SUPABASE_CLI_PATH;
  }

  const env = { ...process.env, PATH: stripNodeModulesBin(process.env.PATH) };

  try {
    const resolved = execSync('command -v supabase', {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim();
    return resolved || 'supabase';
  } catch {
    return 'supabase';
  }
}

function runSupabase(command: string): string {
  const env = { ...process.env };
  delete env.SUPABASE_ACCESS_TOKEN;
  delete env.SUPABASE_PROJECT_REF;
  delete env.SUPABASE_PROJECT_ID;

  env.PATH = stripNodeModulesBin(env.PATH);
  const cliPath = resolveSupabaseCliPath();
  const cli = cliPath.includes(' ')
    ? `"${cliPath.replace(/"/g, '\\"')}"`
    : cliPath;

  return execSync(`${cli} --workdir "${BACKEND_ROOT}" ${command}`, {
    cwd: BACKEND_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
}

function parseSupabaseStatus(raw: string): SupabaseEnv {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Supabase status output missing JSON payload');
  }
  const status = JSON.parse(raw.slice(start, end + 1)) as Record<
    string,
    string
  >;

  const apiUrl =
    status.api_url ?? status.API_URL ?? status.apiUrl ?? status.ApiUrl;
  const anonKey =
    status.anon_key ?? status.ANON_KEY ?? status.anonKey ?? status.AnonKey;
  const serviceRoleKey =
    status.service_role_key ??
    status.SERVICE_ROLE_KEY ??
    status.serviceRoleKey ??
    status.ServiceRoleKey;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      `Supabase status missing keys. Got: ${Object.keys(status).join(', ')}`,
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

function getSupabaseEnv(): SupabaseEnv {
  const raw = runSupabase('status --output json');
  return parseSupabaseStatus(raw);
}

function tryGetSupabaseEnv(): SupabaseEnv | null {
  try {
    return getSupabaseEnv();
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LOCAL_SUPABASE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function getSupabaseEnvFromProcess(): SupabaseEnv | null {
  const apiUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) return null;
  if (!isLocalSupabaseUrl(apiUrl)) return null;
  if (!isLocalSupabaseKeyCompatible(serviceRoleKey)) return null;

  return { apiUrl, anonKey, serviceRoleKey };
}

function isLocalSupabaseKeyCompatible(serviceRoleKey: string): boolean {
  const alg = getJwtAlg(serviceRoleKey);
  if (!alg) return false;
  return alg === 'ES256';
}

function getJwtAlg(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return typeof header.alg === 'string' ? header.alg : null;
  } catch {
    return null;
  }
}

function isMissingTableError(error: { message?: string } | null): boolean {
  const message = error?.message ?? '';
  return (
    message.includes("Could not find the table 'public.user_encryption_key'") ||
    message.includes('relation "user_encryption_key" does not exist')
  );
}

async function isSupabaseApiReachable(apiUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(new URL('/auth/v1/health', apiUrl), {
      signal: controller.signal,
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureSupabaseAvailable(): Promise<SupabaseEnv> {
  const envFromProcess = getSupabaseEnvFromProcess();
  if (envFromProcess && (await isSupabaseApiReachable(envFromProcess.apiUrl))) {
    return envFromProcess;
  }

  const statusEnv = tryGetSupabaseEnv();
  if (
    statusEnv &&
    isLocalSupabaseUrl(statusEnv.apiUrl) &&
    (await isSupabaseApiReachable(statusEnv.apiUrl))
  ) {
    return statusEnv;
  }

  throw new Error(
    'Supabase local is not reachable. Start it with `supabase start` from backend-nest.',
  );
}

async function createTestUser(
  adminClient: SupabaseClient<Database>,
): Promise<{ id: string; email: string }> {
  const email = `encryption-it-${Date.now()}@test.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (error || !data?.user) {
    throw new Error(
      `Failed to create test user: ${error?.message ?? 'unknown'}`,
    );
  }

  return { id: data.user.id, email };
}

async function cleanupUserData(
  adminClient: SupabaseClient<Database>,
  ids: {
    userId: string;
    budgetId: string;
    templateId: string;
  },
): Promise<void> {
  await adminClient.from('transaction').delete().eq('budget_id', ids.budgetId);
  await adminClient.from('budget_line').delete().eq('budget_id', ids.budgetId);
  await adminClient.from('monthly_budget').delete().eq('id', ids.budgetId);
  await adminClient
    .from('template_line')
    .delete()
    .eq('template_id', ids.templateId);
  await adminClient.from('template').delete().eq('id', ids.templateId);
  await adminClient.from('savings_goal').delete().eq('user_id', ids.userId);
  await adminClient
    .from('user_encryption_key')
    .delete()
    .eq('user_id', ids.userId);
  await adminClient.auth.admin.deleteUser(ids.userId);
}

async function getUserEncryptionKeyState(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<{
  salt: string;
  wrapped_dek: string | null;
  key_check: string | null;
}> {
  const { data, error } = await adminClient
    .from('user_encryption_key')
    .select('salt, wrapped_dek, key_check')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to read user_encryption_key for ${userId}: ${error?.message ?? 'missing row'}`,
    );
  }

  return data;
}

describe('Encryption integration (local Supabase)', () => {
  let hasSupabase = false;
  let adminClient: SupabaseClient<Database>;
  let encryptionService: EncryptionService;
  let backfillService: EncryptionBackfillService;
  let rekeyService: EncryptionRekeyService;

  beforeAll(async () => {
    const env = await ensureSupabaseAvailable().catch((error) => {
      if (process.env.CI === 'true') throw error;
      return null;
    });
    if (!env) return;

    const configService = new TestConfigService({
      SUPABASE_URL: env.apiUrl,
      SUPABASE_ANON_KEY: env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
      ENCRYPTION_MASTER_KEY: TEST_MASTER_KEY,
    }) as unknown as ConfigService;
    const supabaseService = new SupabaseService(configService);
    const repository = new EncryptionKeyRepository(supabaseService);

    adminClient = supabaseService.getServiceRoleClient();
    const { error: schemaError } = await adminClient
      .from('user_encryption_key')
      .select('user_id')
      .limit(1);
    if (schemaError) {
      if (isMissingTableError(schemaError)) {
        if (process.env.CI === 'true') {
          throw new Error(
            'Supabase encryption schema is missing in CI (user_encryption_key table not found).',
          );
        }
        return;
      }
      throw new Error(
        `Supabase is reachable but encryption schema is not ready: ${schemaError.message}`,
      );
    }

    hasSupabase = true;
    encryptionService = new EncryptionService(configService, repository, {
      get: () => false,
    } as any);
    backfillService = new EncryptionBackfillService(encryptionService);
    rekeyService = new EncryptionRekeyService(encryptionService);
  });

  afterAll(() => {
    // Leave local Supabase running; tests should not stop shared services.
  });

  it('backfills unencrypted data and zeros plaintext columns', async () => {
    if (!hasSupabase) return;

    const { id: userId } = await createTestUser(adminClient);

    const templateId = randomUUID();
    const budgetId = randomUUID();
    const budgetLineId = randomUUID();
    const transactionId = randomUUID();
    const templateLineId = randomUUID();
    const savingsGoalId = randomUUID();

    try {
      await adminClient.from('template').insert({
        id: templateId,
        user_id: userId,
        name: 'Integration Template',
        is_default: false,
      });

      await adminClient.from('monthly_budget').insert({
        id: budgetId,
        user_id: userId,
        template_id: templateId,
        month: 1,
        year: 2026,
        description: 'Integration Budget',
        ending_balance: 250,
      });

      await adminClient.from('budget_line').insert({
        id: budgetLineId,
        budget_id: budgetId,
        name: 'Budget line',
        amount: 150,
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });

      await adminClient.from('transaction').insert({
        id: transactionId,
        budget_id: budgetId,
        name: 'Transaction',
        amount: 75,
        kind: 'expense',
        transaction_date: '2026-01-15',
      });

      await adminClient.from('template_line').insert({
        id: templateLineId,
        template_id: templateId,
        name: 'Template line',
        amount: 45,
        kind: 'expense',
        recurrence: 'one_off',
      });

      await adminClient.from('savings_goal').insert({
        id: savingsGoalId,
        user_id: userId,
        name: 'Savings goal',
        priority: 'HIGH',
        status: 'ACTIVE',
        target_amount: 500,
        target_date: '2026-12-31',
      });

      const clientKey = Buffer.from(OLD_CLIENT_KEY_HEX, 'hex');
      const dek = await encryptionService.ensureUserDEK(userId, clientKey);

      await backfillService.backfillUserData(userId, dek, adminClient);

      const { data: budgetLine } = await adminClient
        .from('budget_line')
        .select('amount, amount_encrypted')
        .eq('id', budgetLineId)
        .single();
      const { data: transaction } = await adminClient
        .from('transaction')
        .select('amount, amount_encrypted')
        .eq('id', transactionId)
        .single();
      const { data: templateLine } = await adminClient
        .from('template_line')
        .select('amount, amount_encrypted')
        .eq('id', templateLineId)
        .single();
      const { data: savingsGoal } = await adminClient
        .from('savings_goal')
        .select('target_amount, target_amount_encrypted')
        .eq('id', savingsGoalId)
        .single();
      const { data: monthlyBudget } = await adminClient
        .from('monthly_budget')
        .select('ending_balance, ending_balance_encrypted')
        .eq('id', budgetId)
        .single();

      expect(budgetLine?.amount).toBe(0);
      expect(transaction?.amount).toBe(0);
      expect(templateLine?.amount).toBe(0);
      expect(savingsGoal?.target_amount).toBe(0);
      expect(monthlyBudget?.ending_balance).toBe(0);

      expect(budgetLine?.amount_encrypted).toBeTruthy();
      expect(transaction?.amount_encrypted).toBeTruthy();
      expect(templateLine?.amount_encrypted).toBeTruthy();
      expect(savingsGoal?.target_amount_encrypted).toBeTruthy();
      expect(monthlyBudget?.ending_balance_encrypted).toBeTruthy();

      expect(
        encryptionService.decryptAmount(budgetLine!.amount_encrypted!, dek),
      ).toBe(150);
      expect(
        encryptionService.decryptAmount(transaction!.amount_encrypted!, dek),
      ).toBe(75);
      expect(
        encryptionService.decryptAmount(templateLine!.amount_encrypted!, dek),
      ).toBe(45);
      expect(
        encryptionService.decryptAmount(
          savingsGoal!.target_amount_encrypted!,
          dek,
        ),
      ).toBe(500);
      expect(
        encryptionService.decryptAmount(
          monthlyBudget!.ending_balance_encrypted!,
          dek,
        ),
      ).toBe(250);
    } finally {
      await cleanupUserData(adminClient, { userId, budgetId, templateId });
    }
  });

  it('rekeys encrypted data with a new client key', async () => {
    if (!hasSupabase) return;

    const { id: userId } = await createTestUser(adminClient);

    const templateId = randomUUID();
    const budgetId = randomUUID();
    const budgetLineId = randomUUID();
    const transactionId = randomUUID();
    const templateLineId = randomUUID();
    const savingsGoalId = randomUUID();

    try {
      await adminClient.from('template').insert({
        id: templateId,
        user_id: userId,
        name: 'Integration Template',
        is_default: false,
      });

      await adminClient.from('monthly_budget').insert({
        id: budgetId,
        user_id: userId,
        template_id: templateId,
        month: 2,
        year: 2026,
        description: 'Integration Budget',
        ending_balance: 0,
      });

      const oldClientKey = Buffer.from(OLD_CLIENT_KEY_HEX, 'hex');
      const newClientKey = Buffer.from(NEW_CLIENT_KEY_HEX, 'hex');
      const oldDek = await encryptionService.ensureUserDEK(
        userId,
        oldClientKey,
      );

      const oldEncrypted = {
        budgetLine: encryptionService.encryptAmount(150, oldDek),
        transaction: encryptionService.encryptAmount(75, oldDek),
        templateLine: encryptionService.encryptAmount(45, oldDek),
        savingsGoal: encryptionService.encryptAmount(500, oldDek),
        monthlyBudget: encryptionService.encryptAmount(250, oldDek),
      };

      await adminClient.from('budget_line').insert({
        id: budgetLineId,
        budget_id: budgetId,
        name: 'Budget line',
        amount: 0,
        amount_encrypted: oldEncrypted.budgetLine,
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });

      await adminClient.from('transaction').insert({
        id: transactionId,
        budget_id: budgetId,
        name: 'Transaction',
        amount: 0,
        amount_encrypted: oldEncrypted.transaction,
        kind: 'expense',
        transaction_date: '2026-02-15',
      });

      await adminClient.from('template_line').insert({
        id: templateLineId,
        template_id: templateId,
        name: 'Template line',
        amount: 0,
        amount_encrypted: oldEncrypted.templateLine,
        kind: 'expense',
        recurrence: 'one_off',
      });

      await adminClient.from('savings_goal').insert({
        id: savingsGoalId,
        user_id: userId,
        name: 'Savings goal',
        priority: 'HIGH',
        status: 'ACTIVE',
        target_amount: 0,
        target_amount_encrypted: oldEncrypted.savingsGoal,
        target_date: '2026-12-31',
      });

      await adminClient
        .from('monthly_budget')
        .update({
          ending_balance: 0,
          ending_balance_encrypted: oldEncrypted.monthlyBudget,
        })
        .eq('id', budgetId);

      await rekeyService.rekeyUserData(
        userId,
        oldClientKey,
        newClientKey,
        adminClient,
      );

      const { data: budgetLine } = await adminClient
        .from('budget_line')
        .select('amount, amount_encrypted')
        .eq('id', budgetLineId)
        .single();
      const { data: transaction } = await adminClient
        .from('transaction')
        .select('amount, amount_encrypted')
        .eq('id', transactionId)
        .single();
      const { data: templateLine } = await adminClient
        .from('template_line')
        .select('amount, amount_encrypted')
        .eq('id', templateLineId)
        .single();
      const { data: savingsGoal } = await adminClient
        .from('savings_goal')
        .select('target_amount, target_amount_encrypted')
        .eq('id', savingsGoalId)
        .single();
      const { data: monthlyBudget } = await adminClient
        .from('monthly_budget')
        .select('ending_balance, ending_balance_encrypted')
        .eq('id', budgetId)
        .single();

      expect(budgetLine?.amount).toBe(0);
      expect(transaction?.amount).toBe(0);
      expect(templateLine?.amount).toBe(0);
      expect(savingsGoal?.target_amount).toBe(0);
      expect(monthlyBudget?.ending_balance).toBe(0);

      expect(budgetLine?.amount_encrypted).toBeTruthy();
      expect(transaction?.amount_encrypted).toBeTruthy();
      expect(templateLine?.amount_encrypted).toBeTruthy();
      expect(savingsGoal?.target_amount_encrypted).toBeTruthy();
      expect(monthlyBudget?.ending_balance_encrypted).toBeTruthy();

      const newDek = await encryptionService.getUserDEK(userId, newClientKey);

      expect(
        encryptionService.decryptAmount(budgetLine!.amount_encrypted!, newDek),
      ).toBe(150);
      expect(
        encryptionService.decryptAmount(transaction!.amount_encrypted!, newDek),
      ).toBe(75);
      expect(
        encryptionService.decryptAmount(
          templateLine!.amount_encrypted!,
          newDek,
        ),
      ).toBe(45);
      expect(
        encryptionService.decryptAmount(
          savingsGoal!.target_amount_encrypted!,
          newDek,
        ),
      ).toBe(500);
      expect(
        encryptionService.decryptAmount(
          monthlyBudget!.ending_balance_encrypted!,
          newDek,
        ),
      ).toBe(250);
    } finally {
      await cleanupUserData(adminClient, { userId, budgetId, templateId });
    }
  });

  it('recovers data with existing salt so new client key works after recovery', async () => {
    if (!hasSupabase) return;

    const { id: userId } = await createTestUser(adminClient);

    const templateId = randomUUID();
    const budgetId = randomUUID();
    const budgetLineId = randomUUID();

    try {
      await adminClient.from('template').insert({
        id: templateId,
        user_id: userId,
        name: 'Recovery Template',
        is_default: false,
      });

      await adminClient.from('monthly_budget').insert({
        id: budgetId,
        user_id: userId,
        template_id: templateId,
        month: 3,
        year: 2026,
        description: 'Recovery Budget',
      });

      const oldClientKey = Buffer.from(OLD_CLIENT_KEY_HEX, 'hex');
      const recoveredClientKey = Buffer.from(RECOVERED_CLIENT_KEY_HEX, 'hex');
      const oldDek = await encryptionService.ensureUserDEK(
        userId,
        oldClientKey,
      );
      const encryptedBeforeRecover = encryptionService.encryptAmount(
        321.45,
        oldDek,
      );

      await adminClient.from('budget_line').insert({
        id: budgetLineId,
        budget_id: budgetId,
        name: 'Recovered line',
        amount: 0,
        amount_encrypted: encryptedBeforeRecover,
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });

      const beforeRecoveryState = await getUserEncryptionKeyState(
        adminClient,
        userId,
      );
      const { formatted: recoveryKey } =
        await encryptionService.setupRecoveryKey(userId, oldClientKey);
      const afterSetupState = await getUserEncryptionKeyState(
        adminClient,
        userId,
      );

      expect(afterSetupState.salt).toBe(beforeRecoveryState.salt);
      expect(afterSetupState.wrapped_dek).toBeTruthy();

      await encryptionService.recoverWithKey(
        userId,
        recoveryKey,
        recoveredClientKey,
        async (oldRecoveredDek, newRecoveredDek) => {
          await rekeyService.reEncryptAllUserData(
            userId,
            oldRecoveredDek,
            newRecoveredDek,
            adminClient,
          );
        },
      );

      const afterRecoverState = await getUserEncryptionKeyState(
        adminClient,
        userId,
      );
      const { data: lineAfterRecover } = await adminClient
        .from('budget_line')
        .select('amount, amount_encrypted')
        .eq('id', budgetLineId)
        .single();

      expect(afterRecoverState.salt).toBe(afterSetupState.salt);
      expect(afterRecoverState.wrapped_dek).toBeTruthy();
      expect(afterRecoverState.wrapped_dek).not.toBe(
        afterSetupState.wrapped_dek,
      );
      expect(lineAfterRecover?.amount).toBe(0);
      expect(lineAfterRecover?.amount_encrypted).toBeTruthy();
      expect(lineAfterRecover?.amount_encrypted).not.toBe(
        encryptedBeforeRecover,
      );

      const recoveredDek = await encryptionService.getUserDEK(
        userId,
        recoveredClientKey,
      );
      expect(
        encryptionService.decryptAmount(
          lineAfterRecover!.amount_encrypted!,
          recoveredDek,
        ),
      ).toBe(321.45);

      expect(() =>
        encryptionService.decryptAmount(
          lineAfterRecover!.amount_encrypted!,
          oldDek,
        ),
      ).toThrow();
    } finally {
      await cleanupUserData(adminClient, { userId, budgetId, templateId });
    }
  });

  it('does not mutate encrypted data or key rows when recovery key is invalid', async () => {
    if (!hasSupabase) return;

    const { id: userId } = await createTestUser(adminClient);

    const templateId = randomUUID();
    const budgetId = randomUUID();
    const budgetLineId = randomUUID();

    try {
      await adminClient.from('template').insert({
        id: templateId,
        user_id: userId,
        name: 'Invalid Recovery Template',
        is_default: false,
      });

      await adminClient.from('monthly_budget').insert({
        id: budgetId,
        user_id: userId,
        template_id: templateId,
        month: 4,
        year: 2026,
        description: 'Invalid Recovery Budget',
      });

      const oldClientKey = Buffer.from(OLD_CLIENT_KEY_HEX, 'hex');
      const newClientKey = Buffer.from(NEW_CLIENT_KEY_HEX, 'hex');
      const oldDek = await encryptionService.ensureUserDEK(
        userId,
        oldClientKey,
      );
      const encryptedAmount = encryptionService.encryptAmount(89.5, oldDek);

      await adminClient.from('budget_line').insert({
        id: budgetLineId,
        budget_id: budgetId,
        name: 'Protected line',
        amount: 0,
        amount_encrypted: encryptedAmount,
        kind: 'expense',
        recurrence: 'fixed',
        is_manually_adjusted: false,
      });

      await encryptionService.setupRecoveryKey(userId, oldClientKey);

      const invalidRecoveryKey =
        encryptionService.generateRecoveryKey().formatted;
      const keyStateBefore = await getUserEncryptionKeyState(
        adminClient,
        userId,
      );
      const { data: rowBefore } = await adminClient
        .from('budget_line')
        .select('amount_encrypted')
        .eq('id', budgetLineId)
        .single();

      let callbackCalled = false;
      try {
        await encryptionService.recoverWithKey(
          userId,
          invalidRecoveryKey,
          newClientKey,
          async (oldRecoveredDek, newRecoveredDek) => {
            callbackCalled = true;
            await rekeyService.reEncryptAllUserData(
              userId,
              oldRecoveredDek,
              newRecoveredDek,
              adminClient,
            );
          },
        );
        expect.unreachable('recoverWithKey should reject invalid recovery key');
      } catch {
        // expected
      }

      const keyStateAfter = await getUserEncryptionKeyState(
        adminClient,
        userId,
      );
      const { data: rowAfter } = await adminClient
        .from('budget_line')
        .select('amount_encrypted')
        .eq('id', budgetLineId)
        .single();

      expect(callbackCalled).toBe(false);
      expect(keyStateAfter.salt).toBe(keyStateBefore.salt);
      expect(keyStateAfter.wrapped_dek).toBe(keyStateBefore.wrapped_dek);
      expect(keyStateAfter.key_check).toBe(keyStateBefore.key_check);
      expect(rowAfter?.amount_encrypted).toBe(rowBefore!.amount_encrypted);
      expect(
        encryptionService.decryptAmount(rowAfter!.amount_encrypted!, oldDek),
      ).toBe(89.5);
    } finally {
      await cleanupUserData(adminClient, { userId, budgetId, templateId });
    }
  });
});
