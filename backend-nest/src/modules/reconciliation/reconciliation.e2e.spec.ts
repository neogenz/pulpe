import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import type { Database } from '../../types/database.types';
import { AppModule } from '../../app.module';
import { UserThrottlerGuard } from '@common/guards/user-throttler.guard';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
} from '@/test/local-supabase';

const TEST_PASSWORD = 'test-password-e2e-123';
const CLIENT_KEY_HEX = 'aa'.repeat(32);

class NoopThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}

describe('Reconciliation E2E (local Supabase)', () => {
  let hasSupabase = false;
  let adminClient: SupabaseClient<Database>;
  let app: INestApplication;
  let userId: string;
  let accessToken: string;

  const put = (body: unknown) =>
    request(app.getHttpServer())
      .put('/api/v1/reconciliation/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Client-Key', CLIENT_KEY_HEX)
      .send(body as object);

  beforeAll(async () => {
    const env = await ensureSupabaseAvailable().catch((error) => {
      if (IS_DEDICATED_INTEGRATION_RUN) throw error;
      return null;
    });
    if (!env) return;

    adminClient = createClient<Database>(env.apiUrl, env.serviceRoleKey);
    const { error: schemaError } = await adminClient
      .from('user_reconciliation')
      .select('user_id')
      .limit(1);
    if (schemaError) {
      if (IS_DEDICATED_INTEGRATION_RUN) throw new Error(schemaError.message);
      return;
    }

    process.env.ENCRYPTION_MASTER_KEY =
      process.env.ENCRYPTION_MASTER_KEY ?? '11'.repeat(32);
    process.env.TURNSTILE_SECRET_KEY =
      process.env.TURNSTILE_SECRET_KEY ?? 'test-turnstile-key';
    process.env.IOS_STORE_URL = 'https://apps.apple.com/app/pulpe';
    process.env.NODE_ENV = 'test';

    const email = `reconciliation-e2e-${Date.now()}@test.local`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }
    userId = data.user.id;

    const { data: session, error: signInError } = await createClient<Database>(
      env.apiUrl,
      env.anonKey,
    ).auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError || !session?.session) {
      throw new Error(`Failed to sign in: ${signInError?.message}`);
    }
    accessToken = session.session.access_token;

    const configValues: Record<string, string> = {
      SUPABASE_URL: env.apiUrl,
      SUPABASE_ANON_KEY: env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
      ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY!,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY!,
      NODE_ENV: 'test',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(UserThrottlerGuard)
      .useClass(NoopThrottlerGuard)
      .overrideProvider(ConfigService)
      .useValue({
        get: <T>(key: string, defaultValue?: T): T =>
          (configValues[key] ?? process.env[key] ?? defaultValue) as T,
        getOrThrow: <T>(key: string): T => {
          const value = configValues[key] ?? process.env[key];
          if (value === undefined) throw new Error(`Missing config: ${key}`);
          return value as T;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix('api');
    await app.init();

    // Initialise the vault (salt first) so the guard accepts the client key.
    await request(app.getHttpServer())
      .get('/api/v1/encryption/salt')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/encryption/setup-recovery')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Client-Key', CLIENT_KEY_HEX)
      .expect(201);
    hasSupabase = true;
  });

  afterAll(async () => {
    await app?.close();
    if (hasSupabase && userId) {
      await adminClient
        .from('user_reconciliation')
        .delete()
        .eq('user_id', userId);
      await adminClient
        .from('user_encryption_key')
        .delete()
        .eq('user_id', userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  it.each([
    ['empty body', {}],
    ['unknown key', { x: 1 }],
    ['text amount', { startingAmount: 'abc' }],
    ['out of range amount', { startingAmount: 1e308 }],
  ])('PUT answers 400 for %s', async (_name, body) => {
    if (!hasSupabase) return;

    await put(body).expect(400);
  });

  it('PUT answers 403 without X-Client-Key', async () => {
    if (!hasSupabase) return;

    const res = await request(app.getHttpServer())
      .put('/api/v1/reconciliation/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ completed: true })
      .expect(403);

    expect(res.body.code).toBe('ERR_AUTH_CLIENT_KEY_MISSING');
  });

  it('GET answers 404 for a budget the user does not own', async () => {
    if (!hasSupabase) return;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/reconciliation/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Client-Key', CLIENT_KEY_HEX)
      .expect(404);

    expect(res.body.code).toBe('ERR_RECONCILIATION_BUDGET_NOT_FOUND');
  });

  it('keeps the encrypted starting amount through a completion-only PUT', async () => {
    if (!hasSupabase) return;

    const budgetId = randomUUID();
    const templateId = randomUUID();
    const { error: templateError } = await adminClient
      .from('template')
      .insert({ id: templateId, user_id: userId, name: 'reconciliation e2e' });
    expect(templateError).toBeNull();
    const { error: budgetError } = await adminClient
      .from('monthly_budget')
      .insert({
        id: budgetId,
        user_id: userId,
        month: 1,
        year: 2030,
        description: 'reconciliation e2e',
        template_id: templateId,
      });
    expect(budgetError).toBeNull();

    try {
      await put({ startingAmount: 3100.126 }).expect(200);

      const { data: row } = await adminClient
        .from('user_reconciliation')
        .select('starting_amount')
        .eq('user_id', userId)
        .single();
      expect(row?.starting_amount).toBeTruthy();
      expect(row?.starting_amount).not.toContain('3100');

      const completed = await put({ completed: true }).expect(200);
      expect(completed.body.data).toEqual({
        startingAmount: 3100.13,
        hasCompletedComparison: true,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reconciliation/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Client-Key', CLIENT_KEY_HEX)
        .expect(200);
      expect(res.body.data.startingAmount).toBe(3100.13);
      expect(res.body.data.hasCompletedComparison).toBe(true);
    } finally {
      await adminClient.from('monthly_budget').delete().eq('id', budgetId);
      await adminClient.from('template').delete().eq('id', templateId);
    }
  }, 30_000);

  it('GET prices the two previous budgets and ignores the third', async () => {
    if (!hasSupabase) return;

    const templateId = randomUUID();
    const periods = [8, 9, 10, 11].map((month) => ({
      id: randomUUID(),
      month,
    }));
    const [august, september, october, november] = periods.map((p) => p.id);
    const call = (method: 'get' | 'post', url: string) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Client-Key', CLIENT_KEY_HEX);
    const addMovement = (
      budgetId: string,
      name: string,
      kind: 'income' | 'expense',
      amount: number,
      checked: boolean,
    ) =>
      call('post', '/api/v1/transactions')
        .send({
          budgetId,
          name,
          kind,
          amount,
          checkedAt: checked ? new Date().toISOString() : null,
        })
        .expect(201);

    await adminClient
      .from('template')
      .insert({ id: templateId, user_id: userId, name: 'reconciliation e2e' });
    await adminClient.from('monthly_budget').insert(
      periods.map(({ id, month }) => ({
        id,
        user_id: userId,
        month,
        year: 2030,
        description: 'reconciliation e2e',
        template_id: templateId,
      })),
    );

    try {
      await addMovement(october!, 'Salaire', 'income', 1800, true);
      await addMovement(october!, 'Carte', 'expense', 800, false);
      await addMovement(september!, 'Salaire', 'income', 500, true);
      await addMovement(september!, 'Pharmacie', 'expense', 40, false);
      await addMovement(august!, 'Vieux', 'expense', 5, false);

      const started = performance.now();
      const res = await call(
        'get',
        `/api/v1/reconciliation/${november}`,
      ).expect(200);
      console.info(
        `reconciliation GET with 2 prior budgets: ${Math.round(performance.now() - started)}ms`,
      );

      expect(res.body.data.priorCorrection).toBe(840);
      expect(
        res.body.data.priorItems.map(
          (i: { name: string; monthsAgo: number; effect: number }) => [
            i.name,
            i.monthsAgo,
            i.effect,
          ],
        ),
      ).toEqual([
        ['Carte', 1, -800],
        ['Pharmacie', 2, -40],
      ]);

      const first = await call(
        'get',
        `/api/v1/reconciliation/${august}`,
      ).expect(200);
      expect(first.body.data.priorCorrection).toBe(0);
      expect(first.body.data.priorItems).toEqual([]);
    } finally {
      await adminClient
        .from('transaction')
        .delete()
        .in(
          'budget_id',
          periods.map((p) => p.id),
        );
      await adminClient
        .from('monthly_budget')
        .delete()
        .in(
          'id',
          periods.map((p) => p.id),
        );
      await adminClient.from('template').delete().eq('id', templateId);
    }
  }, 30_000);

  it('GET answers 404 for a real budget of another user', async () => {
    if (!hasSupabase) return;

    const { data, error } = await adminClient.auth.admin.createUser({
      email: `reconciliation-e2e-other-${Date.now()}@test.local`,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !data?.user) throw new Error(error?.message);
    const otherId = data.user.id;
    const templateId = randomUUID();
    const budgetId = randomUUID();
    try {
      await adminClient
        .from('template')
        .insert({ id: templateId, user_id: otherId, name: 'other e2e' });
      const { error: budgetError } = await adminClient
        .from('monthly_budget')
        .insert({
          id: budgetId,
          user_id: otherId,
          month: 1,
          year: 2031,
          description: 'other e2e',
          template_id: templateId,
        });
      expect(budgetError).toBeNull();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reconciliation/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Client-Key', CLIENT_KEY_HEX)
        .expect(404);

      expect(res.body.code).toBe('ERR_RECONCILIATION_BUDGET_NOT_FOUND');
    } finally {
      await adminClient.from('monthly_budget').delete().eq('id', budgetId);
      await adminClient.from('template').delete().eq('id', templateId);
      await adminClient.auth.admin.deleteUser(otherId);
    }
  }, 30_000);

  it('GET follows previousBudgetId across a missing month', async () => {
    if (!hasSupabase) return;

    const templateId = randomUUID();
    const periods = [2, 4, 5, 7].map((month) => ({ id: randomUUID(), month }));
    const [february, april, may, july] = periods.map((p) => p.id);
    const addExpense = (budgetId: string, name: string, amount: number) =>
      request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Client-Key', CLIENT_KEY_HEX)
        .send({ budgetId, name, kind: 'expense', amount, checkedAt: null })
        .expect(201);

    await adminClient
      .from('template')
      .insert({ id: templateId, user_id: userId, name: 'reconciliation e2e' });
    await adminClient.from('monthly_budget').insert(
      periods.map(({ id, month }) => ({
        id,
        user_id: userId,
        month,
        year: 2031,
        description: 'reconciliation e2e',
        template_id: templateId,
      })),
    );

    try {
      await addExpense(may!, 'Mai', 10);
      await addExpense(april!, 'Avril', 20);
      await addExpense(february!, 'Fevrier', 30);

      // June is absent: May and April are the two budgets before July.
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reconciliation/${july}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Client-Key', CLIENT_KEY_HEX)
        .expect(200);

      expect(
        res.body.data.priorItems.map(
          (i: { name: string; monthsAgo: number }) => [i.name, i.monthsAgo],
        ),
      ).toEqual([
        ['Mai', 1],
        ['Avril', 2],
      ]);
    } finally {
      await adminClient
        .from('transaction')
        .delete()
        .in(
          'budget_id',
          periods.map((p) => p.id),
        );
      await adminClient
        .from('monthly_budget')
        .delete()
        .in(
          'id',
          periods.map((p) => p.id),
        );
      await adminClient.from('template').delete().eq('id', templateId);
    }
  }, 30_000);
});
