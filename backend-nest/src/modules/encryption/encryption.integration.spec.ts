import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { EncryptionService } from './encryption.service';
import { EncryptionBackfillService } from './encryption-backfill.service';
import { EncryptionRekeyService } from './encryption-rekey.service';

const BACKEND_ROOT = resolve(__dirname, '../../../..');

const TEST_MASTER_KEY = '11'.repeat(32);
const OLD_CLIENT_KEY_HEX = 'aa'.repeat(32);
const NEW_CLIENT_KEY_HEX = 'bb'.repeat(32);

type SupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function runSupabase(command: string): string {
  return execSync(`bunx supabase ${command}`, {
    cwd: BACKEND_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
}

function getSupabaseEnv(): SupabaseEnv {
  const raw = runSupabase('status --output json');
  const status = JSON.parse(raw) as Record<string, string>;

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

describe('Encryption integration (local Supabase)', () => {
  let adminClient: SupabaseClient<Database>;
  let encryptionService: EncryptionService;
  let backfillService: EncryptionBackfillService;
  let rekeyService: EncryptionRekeyService;

  beforeAll(async () => {
    runSupabase('start');

    const env = getSupabaseEnv();
    process.env.SUPABASE_URL = env.apiUrl;
    process.env.SUPABASE_ANON_KEY = env.anonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.serviceRoleKey;
    process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;

    const configService = new ConfigService();
    const supabaseService = new SupabaseService(configService);
    const repository = new EncryptionKeyRepository(supabaseService);

    adminClient = supabaseService.getServiceRoleClient();
    encryptionService = new EncryptionService(configService, repository, {
      get: () => false,
    } as any);
    backfillService = new EncryptionBackfillService(encryptionService);
    rekeyService = new EncryptionRekeyService(encryptionService);
  });

  afterAll(() => {
    runSupabase('stop');
  });

  it('backfills unencrypted data and zeros plaintext columns', async () => {
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

      const newDek = await encryptionService.getUserDEK(userId, newClientKey);

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

      expect(budgetLine?.amount_encrypted).not.toBe(oldEncrypted.budgetLine);
      expect(transaction?.amount_encrypted).not.toBe(oldEncrypted.transaction);
      expect(templateLine?.amount_encrypted).not.toBe(
        oldEncrypted.templateLine,
      );
      expect(savingsGoal?.target_amount_encrypted).not.toBe(
        oldEncrypted.savingsGoal,
      );
      expect(monthlyBudget?.ending_balance_encrypted).not.toBe(
        oldEncrypted.monthlyBudget,
      );

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
});
