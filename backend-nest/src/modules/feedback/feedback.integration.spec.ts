import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { AppModule, createPinoLoggerConfig } from '@/app.module';
import type { Database } from '@/types/database.types';
import { UserThrottlerGuard } from '@common/guards/user-throttler.guard';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
} from '@/test/local-supabase';

const TEST_PASSWORD = 'feedback-test-password-123';

class NoopThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}

describe('POST /api/v1/feedback (local Supabase)', () => {
  let app: INestApplication;
  let admin: SupabaseClient<Database>;
  let userClient: SupabaseClient<Database>;
  let accessToken = '';
  let userId = '';
  let hasSupabase = false;

  beforeAll(async () => {
    const env = await ensureSupabaseAvailable().catch((error) => {
      if (IS_DEDICATED_INTEGRATION_RUN) throw error;
      return null;
    });
    if (!env) return;

    const configValues: Record<string, string> = {
      SUPABASE_URL: env.apiUrl,
      SUPABASE_ANON_KEY: env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
      ENCRYPTION_MASTER_KEY: '11'.repeat(32),
      TURNSTILE_SECRET_KEY: 'test-turnstile-key',
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      NODE_ENV: 'test',
    };

    admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);
    const email = `feedback-${crypto.randomUUID()}@test.local`;
    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
    if (userError || !userData.user) {
      throw new Error(`createUser: ${userError?.message ?? 'no user'}`);
    }
    userId = userData.user.id;

    const authClient = createClient<Database>(env.apiUrl, env.anonKey);
    const { data: sessionData, error: sessionError } =
      await authClient.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD,
      });
    if (sessionError || !sessionData.session) {
      throw new Error(`signIn: ${sessionError?.message ?? 'no session'}`);
    }
    accessToken = sessionData.session.access_token;
    userClient = createClient<Database>(env.apiUrl, env.anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

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
    hasSupabase = true;
  });

  afterAll(async () => {
    await app?.close();
    if (hasSupabase && userId) await admin.auth.admin.deleteUser(userId);
  });

  async function rowCount(): Promise<number> {
    const { count, error } = await admin
      .from('user_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  it('reports the status and stores web feedback without an iOS version', async () => {
    if (!hasSupabase) return;
    const status = () =>
      request(app.getHttpServer())
        .get('/api/v1/feedback/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

    expect((await status()).body).toEqual({ hasSubmitted: false });

    await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ overallRating: 3, appVersion: '0.52.0', platform: 'web' })
      .expect(204);

    expect((await status()).body).toEqual({ hasSubmitted: true });
    const { data, error } = await admin
      .from('user_feedback')
      .select('platform, ios_version')
      .eq('user_id', userId);
    if (error) throw error;
    expect(data).toEqual([{ platform: 'web', ios_version: null }]);
  });

  it('never lets the client read feedback content back', async () => {
    if (!hasSupabase) return;
    const { error } = await userClient.from('user_feedback').select('comment');
    expect(error?.code).toBe('42501');
  });

  it('never lets the client see that another account answered', async () => {
    if (!hasSupabase) return;
    const { data: other, error: otherError } =
      await admin.auth.admin.createUser({
        email: `feedback-other-${crypto.randomUUID()}@test.local`,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
    if (otherError || !other.user) {
      throw new Error(`createUser: ${otherError?.message ?? 'no user'}`);
    }
    const otherId = other.user.id;
    try {
      const { error: insertError } = await admin.from('user_feedback').insert({
        user_id: otherId,
        overall_rating: 4,
        app_version: '0.52.0',
        platform: 'web',
      });
      if (insertError) throw insertError;

      // Unfiltered on purpose: only the policy may hide the other account.
      const { data, error } = await userClient
        .from('user_feedback')
        .select('user_id');
      if (error) throw error;
      expect(data.map((row) => row.user_id)).not.toContain(otherId);
      expect(new Set(data.map((row) => row.user_id))).toEqual(
        new Set([userId]),
      );
    } finally {
      await admin.auth.admin.deleteUser(otherId);
    }
  });

  it('stores minimal and complete feedback for the token owner', async () => {
    if (!hasSupabase) return;

    await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ overallRating: 4, appVersion: '1.4.0', iosVersion: '19.0' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        overallRating: 5,
        onboarding: 4,
        budgetClarity: 3,
        currentMonth: 5,
        futurePlanning: 2,
        homeClarity: 4,
        comment: 'Clair et rapide',
        appVersion: '1.4.0',
        iosVersion: '19.0',
      })
      .expect(204);

    const { data, error } = await admin
      .from('user_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw error;
    const iosRows = data?.filter((row) => row.platform === 'ios');
    expect(iosRows).toHaveLength(2);
    expect(iosRows?.[0]).toMatchObject({
      user_id: userId,
      overall_rating: 4,
      comment: null,
    });
    expect(iosRows?.[1]).toMatchObject({
      user_id: userId,
      overall_rating: 5,
      onboarding: 4,
      current_month: 5,
      comment: 'Clair et rapide',
    });
  });

  it('rejects invalid, oversized and unknown input without writing', async () => {
    if (!hasSupabase) return;
    const before = await rowCount();
    const invalidPayloads = [
      { overallRating: 0, appVersion: '1.4.0', iosVersion: '19.0' },
      {
        overallRating: 4,
        comment: 'a'.repeat(1_001),
        appVersion: '1.4.0',
        iosVersion: '19.0',
      },
      {
        overallRating: 4,
        appVersion: '1.4.0',
        iosVersion: '19.0',
        userId: crypto.randomUUID(),
      },
    ];

    for (const payload of invalidPayloads) {
      await request(app.getHttpServer())
        .post('/api/v1/feedback')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload)
        .expect(400);
    }
    expect(await rowCount()).toBe(before);
  });

  it('rejects a request without a session without writing', async () => {
    if (!hasSupabase) return;
    const before = await rowCount();
    await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({ overallRating: 4, appVersion: '1.4.0', iosVersion: '19.0' })
      .expect(401);
    expect(await rowCount()).toBe(before);
  });

  it('redacts every feedback value from detailed HTTP logs', () => {
    const paths = createPinoLoggerConfig({
      get: (key: string) =>
        key === 'DEBUG_HTTP_FULL' ? 'true' : 'development',
    } as ConfigService).pinoHttp.redact.paths;

    for (const field of [
      'overallRating',
      'onboarding',
      'budgetClarity',
      'currentMonth',
      'futurePlanning',
      'homeClarity',
      'comment',
    ]) {
      expect(paths).toContain(`req.body.${field}`);
    }
  });
});
