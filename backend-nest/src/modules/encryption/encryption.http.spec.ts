import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  type INestApplication,
  VersioningType,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { PinoLogger } from 'nestjs-pino';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { createInfoLoggerProvider } from '@common/logger';

const VALID_HEX_KEY = 'ab'.repeat(32);
const VALID_HEX_KEY_ALT = 'cd'.repeat(32);
const MOCK_USER_ID = 'user-http-test';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: MOCK_USER_ID,
      email: 'http-test@test.local',
      accessToken: 'mock-token',
      clientKey: Buffer.alloc(32, 0xab),
    };
    req.supabase = {};
    return true;
  }
}

function createMockEncryptionService() {
  return {
    getVaultStatus: mock(() =>
      Promise.resolve({
        pinCodeConfigured: true,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: true,
      }),
    ),
    getUserSalt: mock(() =>
      Promise.resolve({
        salt: 'aabb00ff',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      }),
    ),
    verifyAndEnsureKeyCheck: mock(() => Promise.resolve(true)),
    changePinRekey: mock(() =>
      Promise.resolve({
        keyCheck: 'mock-key-check',
        recoveryKey: 'MOCK-RECO-VERY-KEY0',
      }),
    ),
    recoverWithKey: mock(() => Promise.resolve()),
    reEncryptAllUserData: mock(() => Promise.resolve()),
    createRecoveryKey: mock(() =>
      Promise.resolve({ formatted: 'XXXX-YYYY-ZZZZ-1234' }),
    ),
    regenerateRecoveryKey: mock(() =>
      Promise.resolve({ formatted: 'AAAA-BBBB-CCCC-5678' }),
    ),
    verifyRecoveryKey: mock(() => Promise.resolve()),
    ensureUserDEK: mock(() => Promise.resolve(Buffer.alloc(32))),
    getUserDEK: mock(() => Promise.resolve(Buffer.alloc(32))),
    generateKeyCheck: mock(() => 'mock-key-check'),
  };
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

let app: INestApplication;
let mockService: ReturnType<typeof createMockEncryptionService>;

beforeAll(async () => {
  mockService = createMockEncryptionService();
  const mockLogger = createMockPinoLogger();

  const moduleRef = await Test.createTestingModule({
    controllers: [EncryptionController],
    providers: [
      { provide: EncryptionService, useValue: mockService },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      {
        provide: APP_FILTER,
        useFactory: () => new GlobalExceptionFilter(mockLogger as PinoLogger),
      },
      { provide: PinoLogger, useValue: mockLogger },
      createInfoLoggerProvider(EncryptionController.name),
      Reflector,
    ],
  })
    .overrideGuard(AuthGuard)
    .useClass(MockAuthGuard)
    .compile();

  app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('Encryption HTTP pipeline', () => {
  // ──────────────────────────────────────────────
  // POST /api/v1/encryption/validate-key
  // ──────────────────────────────────────────────
  describe('POST /api/v1/encryption/validate-key', () => {
    it('returns 204 with valid clientKey', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: VALID_HEX_KEY })
        .expect(204);
    });

    it('returns 400 Zod error when clientKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({})
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error when clientKey is wrong type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: 123 })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error for invalid hex', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: 'not-valid-hex' })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 ERR_AUTH_CLIENT_KEY_INVALID for all-zero key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: '00'.repeat(32) })
        .expect(400);

      expect(res.body.code).toBe('ERR_AUTH_CLIENT_KEY_INVALID');
    });

    it('returns 400 ERR_ENCRYPTION_KEY_CHECK_FAILED when service returns false', async () => {
      mockService.verifyAndEnsureKeyCheck.mockImplementationOnce(() =>
        Promise.resolve(false),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: VALID_HEX_KEY })
        .expect(400);

      expect(res.body.code).toBe('ERR_ENCRYPTION_KEY_CHECK_FAILED');
    });
  });

  // ──────────────────────────────────────────────
  // POST /api/v1/encryption/change-pin
  // ──────────────────────────────────────────────
  describe('POST /api/v1/encryption/change-pin', () => {
    it('returns 200 with keyCheck and recoveryKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: VALID_HEX_KEY_ALT })
        .expect(200);

      expect(res.body).toEqual({
        keyCheck: 'mock-key-check',
        recoveryKey: 'MOCK-RECO-VERY-KEY0',
      });
    });

    it('returns 200 with custom recoveryKey', async () => {
      mockService.changePinRekey.mockImplementationOnce(() =>
        Promise.resolve({
          keyCheck: 'new-kc',
          recoveryKey: 'ABCD-EFGH-IJKL-MNOP',
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: VALID_HEX_KEY_ALT })
        .expect(200);

      expect(res.body.recoveryKey).toBe('ABCD-EFGH-IJKL-MNOP');
    });

    it('returns 400 Zod error when oldClientKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ newClientKey: VALID_HEX_KEY_ALT })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error when newClientKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error on empty body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({})
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 ERR_ENCRYPTION_SAME_KEY when service throws', async () => {
      mockService.changePinRekey.mockImplementationOnce(() =>
        Promise.reject(
          new BusinessException(ERROR_DEFINITIONS.ENCRYPTION_SAME_KEY),
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: VALID_HEX_KEY_ALT })
        .expect(400);

      expect(res.body.code).toBe('ERR_ENCRYPTION_SAME_KEY');
    });

    it('returns 400 ERR_ENCRYPTION_KEY_CHECK_FAILED when old key is wrong', async () => {
      mockService.changePinRekey.mockImplementationOnce(() =>
        Promise.reject(
          new BusinessException(ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED),
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: VALID_HEX_KEY_ALT })
        .expect(400);

      expect(res.body.code).toBe('ERR_ENCRYPTION_KEY_CHECK_FAILED');
    });

    it('returns 500 ERR_ENCRYPTION_REKEY_PARTIAL_FAILURE when rekey partially fails', async () => {
      mockService.changePinRekey.mockImplementationOnce(() =>
        Promise.reject(
          new BusinessException(
            ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE,
          ),
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: VALID_HEX_KEY_ALT })
        .expect(500);

      expect(res.body.code).toBe('ERR_ENCRYPTION_REKEY_PARTIAL_FAILURE');
    });

    it('returns 400 Zod error for invalid hex oldClientKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: 'not-hex', newClientKey: VALID_HEX_KEY_ALT })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error for invalid hex newClientKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: VALID_HEX_KEY, newClientKey: 'not-hex' })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });
  });

  // ──────────────────────────────────────────────
  // POST /api/v1/encryption/recover
  // ──────────────────────────────────────────────
  describe('POST /api/v1/encryption/recover', () => {
    it('returns 200 { success: true } on valid recovery', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({
          recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
          newClientKey: VALID_HEX_KEY,
        })
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('returns 400 Zod error when recoveryKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({ newClientKey: VALID_HEX_KEY })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 ERR_RECOVERY_KEY_INVALID for empty recoveryKey string', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({ recoveryKey: '', newClientKey: VALID_HEX_KEY })
        .expect(400);

      expect(res.body.code).toBe('ERR_RECOVERY_KEY_INVALID');
    });

    it('returns 400 ERR_RECOVERY_KEY_INVALID for whitespace-only recoveryKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({ recoveryKey: '   ', newClientKey: VALID_HEX_KEY })
        .expect(400);

      expect(res.body.code).toBe('ERR_RECOVERY_KEY_INVALID');
    });

    it('returns 400 Zod error for invalid hex newClientKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({ recoveryKey: 'XXXX-YYYY-ZZZZ', newClientKey: 'not-valid-hex' })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 Zod error when newClientKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .send({ recoveryKey: 'XXXX-YYYY-ZZZZ-1234' })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/encryption/verify-recovery-key', () => {
    it('returns 204 when verification succeeds', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/encryption/verify-recovery-key')
        .send({
          recoveryKey:
            'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM',
        })
        .expect(204);

      expect(mockService.verifyRecoveryKey.mock.calls.length).toBe(1);
    });

    it('returns 400 Zod error when recoveryKey is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/verify-recovery-key')
        .send({})
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
    });

    it('returns 400 ERR_RECOVERY_KEY_INVALID when service rejects', async () => {
      mockService.verifyRecoveryKey.mockImplementation(() => {
        throw new BusinessException(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID);
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/verify-recovery-key')
        .send({ recoveryKey: 'WRONG-KEY0-WRONG-KEY0-WRONG-KEY0-WRONG-KEY0' })
        .expect(400);

      expect(res.body.code).toBe('ERR_RECOVERY_KEY_INVALID');
      mockService.verifyRecoveryKey.mockImplementation(() => Promise.resolve());
    });
  });

  // ──────────────────────────────────────────────
  // GET /api/v1/encryption/vault-status
  // ──────────────────────────────────────────────
  describe('GET /api/v1/encryption/vault-status', () => {
    it('returns 200 with three boolean flags', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/encryption/vault-status')
        .expect(200);

      expect(res.body).toEqual({
        pinCodeConfigured: true,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: true,
      });
    });
  });

  // ──────────────────────────────────────────────
  // GET /api/v1/encryption/salt
  // ──────────────────────────────────────────────
  describe('GET /api/v1/encryption/salt', () => {
    it('returns 200 with salt, kdfIterations, and hasRecoveryKey', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/encryption/salt')
        .expect(200);

      expect(res.body).toEqual({
        salt: 'aabb00ff',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      });
    });
  });

  // ──────────────────────────────────────────────
  // Error response shape
  // ──────────────────────────────────────────────
  describe('Error response shape', () => {
    it('includes standard error envelope fields', async () => {
      // Use all-zero key (valid hex, passes Zod, caught by controller buffer check)
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/validate-key')
        .send({ clientKey: '00'.repeat(32) })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.code).toBe('ERR_AUTH_CLIENT_KEY_INVALID');
      expect(res.body.path).toBe('/api/v1/encryption/validate-key');
      expect(res.body.method).toBe('POST');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('Zod errors include validation details in message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .send({ oldClientKey: 123, newClientKey: true })
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
      expect(res.body.error).toBe('ZodValidationException');
    });
  });
});
