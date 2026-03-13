import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { delimiter, resolve } from 'node:path';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import type { Database } from '../../types/database.types';
import { AppModule } from '../../app.module';
import { UserThrottlerGuard } from '@common/guards/user-throttler.guard';

const BACKEND_ROOT = resolve(__dirname, '../../..');

const TEST_PASSWORD = 'test-password-e2e-123';
const OLD_CLIENT_KEY_HEX = 'aa'.repeat(32);
const NEW_CLIENT_KEY_HEX = 'bb'.repeat(32);

type SupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_SUPABASE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

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

function tryGetSupabaseEnv(): SupabaseEnv | null {
  try {
    const raw = runSupabase('status --output json');
    return parseSupabaseStatus(raw);
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

function getSupabaseEnvFromProcess(): SupabaseEnv | null {
  const apiUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) return null;
  if (!isLocalSupabaseUrl(apiUrl)) return null;
  const alg = getJwtAlg(serviceRoleKey);
  if (!alg || alg !== 'ES256') return null;

  return { apiUrl, anonKey, serviceRoleKey };
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
      if (process.env.CI === 'true') throw error;
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
