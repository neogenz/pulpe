import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
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
const OLD_CLIENT_KEY_HEX = 'aa'.repeat(32);
const NEW_CLIENT_KEY_HEX = 'bb'.repeat(32);

class NoopThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}

describe('Encryption E2E (local Supabase)', () => {
  let hasSupabase = false;
  let adminClient: SupabaseClient<Database>;
  let app: INestApplication;
  let testUserId: string;
  let testUserEmail: string;
  let accessToken: string;

  beforeAll(async () => {
    const env = await ensureSupabaseAvailable().catch((error) => {
      if (IS_DEDICATED_INTEGRATION_RUN) throw error;
      return null;
    });
    if (!env) return;

    // Force-override env vars before AppModule creation.
    // Bun auto-loads .env.local which may have non-JWT service role keys.
    // ConfigModule reads process.env at module init time.
    process.env.SUPABASE_URL = env.apiUrl;
    process.env.SUPABASE_ANON_KEY = env.anonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.serviceRoleKey;
    process.env.ENCRYPTION_MASTER_KEY =
      process.env.ENCRYPTION_MASTER_KEY ?? '11'.repeat(32);
    process.env.TURNSTILE_SECRET_KEY =
      process.env.TURNSTILE_SECRET_KEY ?? 'test-turnstile-key';
    process.env.NODE_ENV = 'test';

    adminClient = createClient<Database>(env.apiUrl, env.serviceRoleKey);

    // Create test user
    testUserEmail = `encryption-e2e-${Date.now()}@test.local`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email: testUserEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(
        `Failed to create test user: ${error?.message ?? 'unknown'}`,
      );
    }
    testUserId = data.user.id;

    // Sign in to get JWT
    const authClient = createClient<Database>(env.apiUrl, env.anonKey);
    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: testUserEmail,
        password: TEST_PASSWORD,
      });
    if (signInError || !signInData?.session?.access_token) {
      throw new Error(
        `Failed to sign in: ${signInError?.message ?? 'no session'}`,
      );
    }
    accessToken = signInData.session.access_token;

    // Build the full app with throttler bypassed.
    // Override ConfigService to use CLI values, since Bun auto-loads
    // .env.local which may contain non-JWT Supabase keys.
    const testConfigValues: Record<string, string> = {
      SUPABASE_URL: env.apiUrl,
      SUPABASE_ANON_KEY: env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
      ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY!,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY!,
      NODE_ENV: 'test',
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(UserThrottlerGuard)
      .useClass(NoopThrottlerGuard)
      .overrideProvider(ConfigService)
      .useValue({
        get: <T>(key: string, defaultValue?: T): T =>
          (testConfigValues[key] ?? process.env[key] ?? defaultValue) as T,
        getOrThrow: <T>(key: string): T => {
          const value = testConfigValues[key] ?? process.env[key];
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
    if (hasSupabase && testUserId) {
      await adminClient
        .from('user_encryption_key')
        .delete()
        .eq('user_id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  it('full change-pin flow: salt → validate-key → change-pin → validate-key with new key', async () => {
    if (!hasSupabase) return;

    // 1. Get salt
    const saltRes = await request(app.getHttpServer())
      .get('/api/v1/encryption/salt')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(saltRes.body.salt).toBeTruthy();
    expect(saltRes.body.kdfIterations).toBe(600000);

    // 2. Validate old key (establishes DEK + key_check)
    await request(app.getHttpServer())
      .post('/api/v1/encryption/validate-key')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientKey: OLD_CLIENT_KEY_HEX })
      .expect(204);

    // 3. Change PIN
    const changePinRes = await request(app.getHttpServer())
      .post('/api/v1/encryption/change-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldClientKey: OLD_CLIENT_KEY_HEX,
        newClientKey: NEW_CLIENT_KEY_HEX,
      })
      .expect(200);

    expect(changePinRes.body.keyCheck).toBeTruthy();
    expect(changePinRes.body.recoveryKey).toBeTruthy();
    expect(changePinRes.body.recoveryKey).toMatch(
      /^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/,
    );

    // 4. Validate new key succeeds
    await request(app.getHttpServer())
      .post('/api/v1/encryption/validate-key')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientKey: NEW_CLIENT_KEY_HEX })
      .expect(204);

    // 5. Verify old key now fails
    const oldKeyRes = await request(app.getHttpServer())
      .post('/api/v1/encryption/validate-key')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientKey: OLD_CLIENT_KEY_HEX })
      .expect(400);

    expect(oldKeyRes.body.code).toBe('ERR_ENCRYPTION_KEY_CHECK_FAILED');
  }, 30_000);

  it('returns 400 when change-pin with wrong old key', async () => {
    if (!hasSupabase) return;

    // The previous test left the user with NEW_CLIENT_KEY_HEX as the active key
    const wrongOldKey = 'ee'.repeat(32);

    const res = await request(app.getHttpServer())
      .post('/api/v1/encryption/change-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldClientKey: wrongOldKey,
        newClientKey: 'ff'.repeat(32),
      })
      .expect(400);

    expect(res.body.code).toBe('ERR_ENCRYPTION_KEY_CHECK_FAILED');
  });

  it('vault-status reflects configured state', async () => {
    if (!hasSupabase) return;

    const res = await request(app.getHttpServer())
      .get('/api/v1/encryption/vault-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(typeof res.body.pinCodeConfigured).toBe('boolean');
    expect(typeof res.body.recoveryKeyConfigured).toBe('boolean');
    expect(typeof res.body.vaultCodeConfigured).toBe('boolean');
    // After previous tests, pin should be configured
    expect(res.body.pinCodeConfigured).toBe(true);
  });

  it('change-pin always generates recovery key and re-wraps on subsequent changes', async () => {
    if (!hasSupabase) return;

    // Current active key is NEW_CLIENT_KEY_HEX from earlier tests
    // Previous test already created a recovery key via PIN change

    // 1. Change PIN again — should always return a new recovery key
    const THIRD_CLIENT_KEY_HEX = 'dd'.repeat(32);
    const changePinRes = await request(app.getHttpServer())
      .post('/api/v1/encryption/change-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldClientKey: NEW_CLIENT_KEY_HEX,
        newClientKey: THIRD_CLIENT_KEY_HEX,
      })
      .expect(200);

    expect(changePinRes.body.keyCheck).toBeTruthy();
    expect(changePinRes.body.recoveryKey).toBeTruthy();
    expect(changePinRes.body.recoveryKey).toMatch(
      /^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/,
    );

    // 2. New key works
    await request(app.getHttpServer())
      .post('/api/v1/encryption/validate-key')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientKey: THIRD_CLIENT_KEY_HEX })
      .expect(204);

    // 3. Old key fails
    const oldKeyRes = await request(app.getHttpServer())
      .post('/api/v1/encryption/validate-key')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientKey: NEW_CLIENT_KEY_HEX })
      .expect(400);

    expect(oldKeyRes.body.code).toBe('ERR_ENCRYPTION_KEY_CHECK_FAILED');
  }, 30_000);

  it('Zod validation rejects malformed body in real app', async () => {
    if (!hasSupabase) return;

    const res = await request(app.getHttpServer())
      .post('/api/v1/encryption/change-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ wrongField: 'value' })
      .expect(400);

    expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
  });
});
