import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LoggerModule } from 'nestjs-pino';
import { AccountDeletionModule } from './account-deletion.module';
import { AccountDeletionService } from './account-deletion.service';
import type { Database } from '../../types/database.types';

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function isSupabaseReachable(): Promise<boolean> {
  if (!supabaseUrl || !serviceRoleKey) return false;
  try {
    const client = createClient<Database>(supabaseUrl, serviceRoleKey);
    const { error } = await client.auth.admin.listUsers({ perPage: 1 });
    return !error;
  } catch {
    return false;
  }
}

let hasSupabase = false;

beforeAll(async () => {
  hasSupabase = await isSupabaseReachable();
});

describe('AccountDeletionService Integration', () => {
  let service: AccountDeletionService;
  let adminClient: SupabaseClient<Database>;
  let testUserId: string;
  let testTemplateId: string;
  let testBudgetId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    if (!hasSupabase) return;

    adminClient = createClient<Database>(supabaseUrl!, serviceRoleKey!);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.local',
        }),
        LoggerModule.forRoot({
          pinoHttp: { level: 'silent' },
        }),
        AccountDeletionModule,
      ],
    }).compile();

    service = moduleRef.get<AccountDeletionService>(AccountDeletionService);

    testUserId = `test-${crypto.randomUUID()}`;
    testTemplateId = crypto.randomUUID();
    testBudgetId = crypto.randomUUID();
    testTransactionId = crypto.randomUUID();

    const scheduledDeletionAt = new Date(
      Date.now() - FOUR_DAYS_MS,
    ).toISOString();

    const { error: createUserError } = await adminClient.auth.admin.createUser({
      email: `integration-test-${testUserId}@test.local`,
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: {
        scheduledDeletionAt,
      },
    });

    if (createUserError) {
      throw new Error(`Failed to create test user: ${createUserError.message}`);
    }

    const { data: userData } = await adminClient.auth.admin.listUsers();
    const createdUser = userData.users.find(
      (u) => u.email === `integration-test-${testUserId}@test.local`,
    );

    if (!createdUser) {
      throw new Error('Could not find created test user');
    }

    testUserId = createdUser.id;

    const { error: templateError } = await adminClient.from('template').insert({
      id: testTemplateId,
      user_id: testUserId,
      name: 'Integration Test Template',
      is_default: false,
    });

    if (templateError) {
      throw new Error(
        `Failed to create test template: ${templateError.message}`,
      );
    }

    const { error: budgetError } = await adminClient
      .from('monthly_budget')
      .insert({
        id: testBudgetId,
        user_id: testUserId,
        template_id: testTemplateId,
        month: 1,
        year: 2026,
        description: 'Integration Test Budget',
      });

    if (budgetError) {
      throw new Error(`Failed to create test budget: ${budgetError.message}`);
    }

    const { error: transactionError } = await adminClient
      .from('transaction')
      .insert({
        id: testTransactionId,
        budget_id: testBudgetId,
        name: 'Integration Test Transaction',
        amount: 100,
        kind: 'expense',
        transaction_date: '2026-01-15',
      });

    if (transactionError) {
      throw new Error(
        `Failed to create test transaction: ${transactionError.message}`,
      );
    }
  });

  afterAll(async () => {
    if (!hasSupabase) return;
    try {
      await adminClient.auth.admin.deleteUser(testUserId);
    } catch {
      // User might already be deleted by the test
    }
  });

  it('should delete user with expired grace period and cascade related data', async () => {
    if (!hasSupabase) return;
    const { data: userBefore } =
      await adminClient.auth.admin.getUserById(testUserId);
    expect(userBefore.user).not.toBeNull();

    const { data: templateBefore } = await adminClient
      .from('template')
      .select('id')
      .eq('id', testTemplateId)
      .single();
    expect(templateBefore).not.toBeNull();

    const { data: budgetBefore } = await adminClient
      .from('monthly_budget')
      .select('id')
      .eq('id', testBudgetId)
      .single();
    expect(budgetBefore).not.toBeNull();

    const { data: transactionBefore } = await adminClient
      .from('transaction')
      .select('id')
      .eq('id', testTransactionId)
      .single();
    expect(transactionBefore).not.toBeNull();

    await service.cleanupScheduledDeletions();

    const { data: userAfter } =
      await adminClient.auth.admin.getUserById(testUserId);
    expect(userAfter.user).toBeNull();

    const { data: templateAfter } = await adminClient
      .from('template')
      .select('id')
      .eq('id', testTemplateId)
      .maybeSingle();
    expect(templateAfter).toBeNull();

    const { data: budgetAfter } = await adminClient
      .from('monthly_budget')
      .select('id')
      .eq('id', testBudgetId)
      .maybeSingle();
    expect(budgetAfter).toBeNull();

    const { data: transactionAfter } = await adminClient
      .from('transaction')
      .select('id')
      .eq('id', testTransactionId)
      .maybeSingle();
    expect(transactionAfter).toBeNull();
  });
});
