import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import {
  type INestApplication,
  VersioningType,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { PinoLogger } from 'nestjs-pino';
import { EncryptionController } from './infrastructure/http/encryption.controller';
import { GetVaultStatusUseCase } from './application/get-vault-status.use-case';
import { GetUserSaltUseCase } from './application/get-user-salt.use-case';
import { ValidateUserKeyUseCase } from './application/validate-user-key.use-case';
import { SetupRecoveryKeyUseCase } from './application/setup-recovery-key.use-case';
import { RegenerateRecoveryKeyUseCase } from './application/regenerate-recovery-key.use-case';
import { VerifyRecoveryKeyUseCase } from './application/verify-recovery-key.use-case';
import { RecoverWithRecoveryKeyUseCase } from './application/recover-with-recovery-key.use-case';
import { ChangePinUseCase } from './application/change-pin.use-case';
import { AesGcmCryptoService } from './infrastructure/crypto/aes-gcm.crypto-service';
import { SupabaseEncryptionKeyRepository } from './infrastructure/persistence/supabase-encryption-key.repository';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { ENCRYPTION_KEY_REPOSITORY } from './domain/ports/encryption-key-repository.port';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { createInfoLoggerProvider } from '@common/logger';

const VALID_HEX_KEY = 'ab'.repeat(32);
const MOCK_USER_ID = 'user-repo-error-test-fixture';
const TEST_MASTER_KEY = '11'.repeat(32);
const SALT_HEX = 'aabbccddeeff00112233445566778899';
const KDF_ITERATIONS = 600_000;

const LEAKY_SUPABASE_CODE = 'XX000';
const LEAKY_SUPABASE_MESSAGE = 'connection refused at host XYZ';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: MOCK_USER_ID,
      email: 'repo-error-test@test.local',
      accessToken: 'mock-token',
      clientKey: Buffer.alloc(32, 0xab),
    };
    req.supabase = {};
    return true;
  }
}

function createMockPinoLogger(): Partial<PinoLogger> {
  const noop = () => {};
  return {
    info: noop,
    error: noop,
    warn: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    setContext: noop,
  } as unknown as Partial<PinoLogger>;
}

interface SupabaseResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface FluentBuilder extends PromiseLike<SupabaseResult> {
  select: () => FluentBuilder;
  eq: () => FluentBuilder;
  is: () => FluentBuilder;
  update: () => FluentBuilder;
  upsert: () => FluentBuilder;
  single: () => FluentBuilder;
  maybeSingle: () => FluentBuilder;
}

/**
 * Creates a Supabase mock that pops one result from the stack each time the
 * caller awaits a query chain. Chain methods (select/eq/is/update/upsert/
 * single/maybeSingle) all return the same builder, so a multi-method chain
 * still consumes exactly one stack entry on await.
 */
function makeSupabaseMock(stack: SupabaseResult[]) {
  const buildFluent = (): FluentBuilder => {
    const builder: FluentBuilder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      update: () => builder,
      upsert: () => builder,
      single: () => builder,
      maybeSingle: () => builder,
      then: (onResolve, onReject) => {
        const next = stack.shift();
        const result: SupabaseResult = next ?? {
          data: null,
          error: { code: 'STACK_EMPTY', message: 'mock stack exhausted' },
        };
        return Promise.resolve(result).then(onResolve, onReject);
      },
    };
    return builder;
  };

  const serviceRoleClient = {
    from: (_table: string) => buildFluent(),
  };

  return {
    getServiceRoleClient: () => serviceRoleClient,
    createAuthenticatedClient: () => ({}),
    getClient: () => ({}),
  } as unknown as SupabaseService;
}

async function bootstrapApp(
  stack: SupabaseResult[],
): Promise<INestApplication> {
  const mockLogger = createMockPinoLogger();
  const supabaseServiceMock = makeSupabaseMock(stack);

  const moduleRef = await Test.createTestingModule({
    controllers: [EncryptionController],
    providers: [
      AesGcmCryptoService,
      SupabaseEncryptionKeyRepository,
      GetVaultStatusUseCase,
      GetUserSaltUseCase,
      ValidateUserKeyUseCase,
      SetupRecoveryKeyUseCase,
      RegenerateRecoveryKeyUseCase,
      VerifyRecoveryKeyUseCase,
      RecoverWithRecoveryKeyUseCase,
      ChangePinUseCase,
      {
        provide: ENCRYPTION_KEY_REPOSITORY,
        useExisting: SupabaseEncryptionKeyRepository,
      },
      { provide: SupabaseService, useValue: supabaseServiceMock },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            if (key === 'ENCRYPTION_MASTER_KEY') return TEST_MASTER_KEY;
            return undefined;
          },
        },
      },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      {
        provide: APP_FILTER,
        useFactory: () => new GlobalExceptionFilter(mockLogger as PinoLogger),
      },
      { provide: PinoLogger, useValue: mockLogger },
      Reflector,
      createInfoLoggerProvider(AesGcmCryptoService.name),
      createInfoLoggerProvider(ValidateUserKeyUseCase.name),
      createInfoLoggerProvider(SetupRecoveryKeyUseCase.name),
      createInfoLoggerProvider(RegenerateRecoveryKeyUseCase.name),
      createInfoLoggerProvider(RecoverWithRecoveryKeyUseCase.name),
      createInfoLoggerProvider(ChangePinUseCase.name),
    ],
  })
    .overrideGuard(AuthGuard)
    .useClass(MockAuthGuard)
    .compile();

  const app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

/**
 * The error envelope MUST NOT leak any internal details from the underlying
 * BusinessException's loggingContext or Supabase error object. This helper
 * fails loudly if any forbidden token is observed in the response body or its
 * JSON serialization.
 *
 * Note: the userId echoed at `body.context.userId` comes from
 * `GlobalExceptionFilter.extractRequestContext()` and is the authenticated
 * caller's own id (the user already knows it). That field is part of the
 * project-wide error envelope, not encryption-specific leakage, so it is
 * intentionally excluded from this leak check.
 */
function assertNoSensitiveLeak(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty('loggingContext');
  expect(body).not.toHaveProperty('supabaseMessage');
  expect(body).not.toHaveProperty('supabaseCode');
  expect(body).not.toHaveProperty('cause');
  expect(body).not.toHaveProperty('causeChain');
  expect(body).not.toHaveProperty('rootCause');
  expect(body).not.toHaveProperty('details');
  expect(body).not.toHaveProperty('stack');

  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(LEAKY_SUPABASE_CODE);
  expect(serialized).not.toContain(LEAKY_SUPABASE_MESSAGE);
  expect(serialized).not.toContain('findSaltByUserId');
  expect(serialized).not.toContain('findByUserId');
  expect(serialized).not.toContain('getVaultStatus');
  expect(serialized).not.toContain('updateWrappedDEK');
}

function assertGenericRepositoryFailure(body: Record<string, unknown>): void {
  expect(body.statusCode).toBe(500);
  expect(body.code).toBe('ERR_ENCRYPTION_REPOSITORY_FAILURE');
  expect(body.message).toBe('Encryption key store unavailable');
  expect(body.error).toBe('BusinessException');
  expect(body.success).toBe(false);
  assertNoSensitiveLeak(body);
}

const dbFailure: SupabaseResult = {
  data: null,
  error: { code: LEAKY_SUPABASE_CODE, message: LEAKY_SUPABASE_MESSAGE },
};

const saltOk: SupabaseResult = {
  data: {
    salt: SALT_HEX,
    kdf_iterations: KDF_ITERATIONS,
    key_check: null,
  },
  error: null,
};

const saltOkWithRow: SupabaseResult = {
  data: {
    salt: SALT_HEX,
    kdf_iterations: KDF_ITERATIONS,
    wrapped_dek: null,
    key_check: null,
  },
  error: null,
};

const noopOk: SupabaseResult = { data: null, error: null };

let activeApp: INestApplication | undefined;

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;
});

afterEach(async () => {
  if (activeApp) {
    await activeApp.close();
    activeApp = undefined;
  }
});

describe('Encryption repo error contract (HI-03 regression armor)', () => {
  describe('GET /api/v1/encryption/vault-status', () => {
    it('returns 500 with sanitized envelope when getVaultStatus query errors', async () => {
      activeApp = await bootstrapApp([dbFailure]);

      const res = await request(activeApp.getHttpServer())
        .get('/api/v1/encryption/vault-status')
        .expect(500);

      assertGenericRepositoryFailure(res.body);
    });

    it('returns 200 { false, false, false } when row is missing (PGRST116 contract preserved)', async () => {
      activeApp = await bootstrapApp([
        { data: null, error: { code: 'PGRST116' } },
      ]);

      const res = await request(activeApp.getHttpServer())
        .get('/api/v1/encryption/vault-status')
        .expect(200);

      expect(res.body).toEqual({
        pinCodeConfigured: false,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      });
    });

    it('returns 200 with the three computed flags on a populated row (no behavior change)', async () => {
      activeApp = await bootstrapApp([
        {
          data: {
            key_check: 'kc-ciphertext',
            wrapped_dek: 'wrapped-ciphertext',
          },
          error: null,
        },
      ]);

      const res = await request(activeApp.getHttpServer())
        .get('/api/v1/encryption/vault-status')
        .expect(200);

      expect(res.body).toEqual({
        pinCodeConfigured: true,
        recoveryKeyConfigured: true,
        vaultCodeConfigured: true,
      });
    });
  });

  describe('GET /api/v1/encryption/salt', () => {
    it('returns 500 sanitized envelope when findSaltByUserId errors first', async () => {
      activeApp = await bootstrapApp([dbFailure]);

      const res = await request(activeApp.getHttpServer())
        .get('/api/v1/encryption/salt')
        .expect(500);

      assertGenericRepositoryFailure(res.body);
    });

    it('returns 200 with salt, kdfIterations, hasRecoveryKey on happy path', async () => {
      activeApp = await bootstrapApp([
        saltOk,
        {
          data: { wrapped_dek: 'some-wrapped-ciphertext' },
          error: null,
        },
      ]);

      const res = await request(activeApp.getHttpServer())
        .get('/api/v1/encryption/salt')
        .expect(200);

      expect(res.body).toEqual({
        salt: SALT_HEX,
        kdfIterations: KDF_ITERATIONS,
        hasRecoveryKey: true,
      });
    });
  });

  describe('POST /api/v1/encryption/validate-key', () => {
    it('returns 500 sanitized envelope when first repo call errors', async () => {
      activeApp = await bootstrapApp([dbFailure]);

      const res = await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: VALID_HEX_KEY })
        .expect(500);

      assertGenericRepositoryFailure(res.body);
    });

    it('returns 204 on happy path (row missing key_check, write succeeds)', async () => {
      activeApp = await bootstrapApp([saltOkWithRow, noopOk]);

      await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: VALID_HEX_KEY })
        .expect(204);
    });
  });

  describe('POST /api/v1/encryption/setup-recovery', () => {
    it('returns 500 sanitized envelope when wrap step errors after salt resolves', async () => {
      activeApp = await bootstrapApp([saltOk, dbFailure]);

      const res = await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/setup-recovery')
        .send({})
        .expect(500);

      assertGenericRepositoryFailure(res.body);
    });

    it('returns 201 with formatted recovery key on happy path', async () => {
      activeApp = await bootstrapApp([
        saltOk,
        { data: { user_id: MOCK_USER_ID }, error: null },
        noopOk,
      ]);

      const res = await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/setup-recovery')
        .send({})
        .expect(201);

      expect(res.body).toHaveProperty('recoveryKey');
      expect(typeof res.body.recoveryKey).toBe('string');
      expect(res.body.recoveryKey).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
    });
  });

  describe('POST /api/v1/encryption/regenerate-recovery', () => {
    it('returns 500 sanitized envelope when first findByUserId errors', async () => {
      activeApp = await bootstrapApp([dbFailure]);

      const res = await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/regenerate-recovery')
        .send({})
        .expect(500);

      assertGenericRepositoryFailure(res.body);
    });

    it('returns 201 with formatted recovery key on happy path', async () => {
      activeApp = await bootstrapApp([saltOkWithRow, saltOk, noopOk, noopOk]);

      const res = await request(activeApp.getHttpServer())
        .post('/api/v1/encryption/regenerate-recovery')
        .send({})
        .expect(201);

      expect(res.body).toHaveProperty('recoveryKey');
      expect(typeof res.body.recoveryKey).toBe('string');
      expect(res.body.recoveryKey).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
    });
  });
});
