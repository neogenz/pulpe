import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AesGcmCryptoService } from './aes-gcm.crypto-service';

const TEST_MASTER_KEY = randomBytes(32).toString('hex');
const TEST_USER_ID = 'test-user-123';
const TEST_CLIENT_KEY = randomBytes(32);
const testUuid = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;

const createMockLogger = () => ({
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
});

const createMockConfigService = () => ({
  get: (key: string) => {
    if (key === 'ENCRYPTION_MASTER_KEY') return TEST_MASTER_KEY;
    if (key === 'MCP_WRAPPING_KEY') return 'cd'.repeat(32);
    return undefined;
  },
});

const createEncryptedDataClient = (
  rowsByTable: Record<string, unknown[]> = {},
  pageErrors: Record<number, Error> = {},
  nullPages: ReadonlySet<number> = new Set(),
) => {
  const buildQuery = (data: unknown[]) => {
    let rows = data;
    let rangeStart = 0;
    let rangeEnd = 999;
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => {
          const record = row as Record<string, unknown>;
          return !(column in record) || record[column] === value;
        });
        return query;
      },
      in: (column: string, values: unknown[]) => {
        rows = rows.filter((row) => {
          const record = row as Record<string, unknown>;
          return !(column in record) || values.includes(record[column]);
        });
        return query;
      },
      not: (column: string, _operator: string, value: unknown) => {
        rows = rows.filter(
          (row) => (row as Record<string, unknown>)[column] !== value,
        );
        return query;
      },
      or: (filters: string) => {
        const columns = filters
          .split(',')
          .map((filter) => filter.split('.')[0])
          .filter(Boolean);
        rows = rows.filter((row) =>
          columns.some(
            (column) => (row as Record<string, unknown>)[column!] !== null,
          ),
        );
        return query;
      },
      order: (column: string) => {
        rows = [...rows].sort((left, right) =>
          String((left as Record<string, unknown>)[column]).localeCompare(
            String((right as Record<string, unknown>)[column]),
          ),
        );
        return query;
      },
      range: (from: number, to: number) => {
        rangeStart = from;
        rangeEnd = to;
        return query;
      },
      limit: (count: number) => {
        rangeEnd = rangeStart + count - 1;
        return query;
      },
      then: (
        onResolve: (value: {
          data: unknown[] | null;
          error: Error | null;
        }) => unknown,
        onReject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve(
          pageErrors[rangeStart]
            ? { data: null, error: pageErrors[rangeStart] }
            : nullPages.has(rangeStart)
              ? { data: null, error: null }
              : {
                  data: rows.slice(rangeStart, rangeEnd + 1),
                  error: null,
                },
        ).then(onResolve, onReject),
    };
    return query;
  };
  return {
    from: (table: string) => buildQuery(rowsByTable[table] ?? []),
  };
};

const createEmptyEncryptedDataClient = () => createEncryptedDataClient();

const createMockRepository = (overrides?: {
  findSaltByUserId?: ReturnType<typeof mock>;
  findByUserId?: ReturnType<typeof mock>;
  upsertSalt?: ReturnType<typeof mock>;
  updateWrappedDEK?: ReturnType<typeof mock>;
  updateWrappedDEKIfNull?: ReturnType<typeof mock>;
  hasRecoveryKey?: ReturnType<typeof mock>;
  updateKeyCheckIfNull?: ReturnType<typeof mock>;
  initializeVaultIfEmpty?: ReturnType<typeof mock>;
  getVaultStatus?: ReturnType<typeof mock>;
  rekeyUserData?: ReturnType<typeof mock>;
}) => ({
  rekeyUserData: overrides?.rekeyUserData ?? mock(() => Promise.resolve()),
  findSaltByUserId:
    overrides?.findSaltByUserId ?? mock(() => Promise.resolve(null)),
  findByUserId:
    overrides?.findByUserId ??
    (overrides?.findSaltByUserId
      ? mock(async (userId: string) => {
          const row = await overrides.findSaltByUserId!(userId);
          return row ? { ...row, wrapped_dek: null } : null;
        })
      : mock(() => Promise.resolve(null))),
  upsertSalt: overrides?.upsertSalt ?? mock(() => Promise.resolve()),
  updateWrappedDEK:
    overrides?.updateWrappedDEK ?? mock(() => Promise.resolve()),
  updateWrappedDEKIfNull:
    overrides?.updateWrappedDEKIfNull ??
    (overrides?.updateWrappedDEK
      ? mock((userId: string, wrappedDEK: string) =>
          overrides.updateWrappedDEK!(userId, wrappedDEK),
        )
      : mock(() => Promise.resolve(true))),
  hasRecoveryKey:
    overrides?.hasRecoveryKey ?? mock(() => Promise.resolve(false)),
  updateKeyCheckIfNull:
    overrides?.updateKeyCheckIfNull ?? mock(() => Promise.resolve()),
  initializeVaultIfEmpty:
    overrides?.initializeVaultIfEmpty ??
    mock(async (userId: string, keyCheck: string, wrappedDEK: string) => {
      let updated = true;
      if (overrides?.updateWrappedDEKIfNull) {
        updated = await overrides.updateWrappedDEKIfNull(userId, wrappedDEK);
      } else if (overrides?.updateWrappedDEK) {
        await overrides.updateWrappedDEK(userId, wrappedDEK);
      }
      if (!updated) return false;
      await overrides?.updateKeyCheckIfNull?.(userId, keyCheck);
      return true;
    }),
  getVaultStatus:
    overrides?.getVaultStatus ??
    mock(() =>
      Promise.resolve({
        pinCodeConfigured: false,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      }),
    ),
});

const buildConfiguredRow = async (
  clientKey = TEST_CLIENT_KEY,
  salt = randomBytes(16).toString('hex'),
) => {
  const uninitializedRow = {
    salt,
    kdf_iterations: 600000,
    key_check: null,
  };
  const bootstrapService = new AesGcmCryptoService(
    createMockLogger() as any,
    createMockConfigService() as any,
    createMockRepository({
      findSaltByUserId: mock(() => Promise.resolve(uninitializedRow)),
    }) as any,
  );
  const dek = await bootstrapService.getUserDEK(TEST_USER_ID, clientKey);
  return {
    ...uninitializedRow,
    wrapped_dek: null,
    key_check: bootstrapService.generateKeyCheck(dek),
  };
};

describe('AesGcmCryptoService', () => {
  let service: AesGcmCryptoService;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockConfigService = createMockConfigService();
    mockRepository = createMockRepository();
  });

  describe('wrapSecret / unwrapSecret (agent connections)', () => {
    const build = (config: unknown) =>
      new AesGcmCryptoService(
        createMockLogger() as any,
        config as any,
        mockRepository as any,
      );

    it('round-trips a 32-byte secret and rejects a different wrapping key', () => {
      const secret = Buffer.from('ef'.repeat(32), 'hex');
      const wrapped = build(mockConfigService).wrapSecret(secret);
      expect(wrapped).not.toContain(secret.toString('hex'));
      expect(build(mockConfigService).unwrapSecret(wrapped)).toEqual(secret);

      const other = build({
        get: (key: string) =>
          key === 'MCP_WRAPPING_KEY' ? '12'.repeat(32) : TEST_MASTER_KEY,
      });
      expect(() => other.unwrapSecret(wrapped)).toThrow();
    });

    it('refuses to wrap when MCP_WRAPPING_KEY is absent', () => {
      const noKey = build({
        get: (key: string) =>
          key === 'ENCRYPTION_MASTER_KEY' ? TEST_MASTER_KEY : undefined,
      });
      expect(() => noKey.wrapSecret(Buffer.alloc(32, 1))).toThrow(
        /MCP_WRAPPING_KEY/,
      );
    });
  });

  describe('constructor', () => {
    it('should create service with valid ENCRYPTION_MASTER_KEY', () => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
      expect(service).toBeDefined();
    });

    it('should throw error when ENCRYPTION_MASTER_KEY is missing', () => {
      const configWithoutKey = {
        get: () => undefined,
      };
      expect(() => {
        new AesGcmCryptoService(
          createMockLogger() as any,
          configWithoutKey as any,
          mockRepository as any,
        );
      }).toThrow('ENCRYPTION_MASTER_KEY must be defined');
    });

    it('should throw error when ENCRYPTION_MASTER_KEY is empty string', () => {
      const configWithEmptyKey = {
        get: () => '',
      };
      expect(() => {
        new AesGcmCryptoService(
          createMockLogger() as any,
          configWithEmptyKey as any,
          mockRepository as any,
        );
      }).toThrow('ENCRYPTION_MASTER_KEY must be defined');
    });
  });

  describe('encryptAmount and decryptAmount roundtrip', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should encrypt and decrypt amount returning original value', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });

    it('should handle zero amount', () => {
      const dek = randomBytes(32);
      const amount = 0;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });

    it('should handle small decimal amount', () => {
      const dek = randomBytes(32);
      const amount = 0.01;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });

    it('should handle large amount', () => {
      const dek = randomBytes(32);
      const amount = 99999.99;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });

    it('should handle negative amount', () => {
      const dek = randomBytes(32);
      const amount = -500.25;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });
  });

  describe('encryptAmount', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should produce different ciphertexts for same plaintext (random IVs)', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted1 = service.encryptAmount(amount, dek);
      const encrypted2 = service.encryptAmount(amount, dek);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return base64 encoded ciphertext', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);

      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
      expect(Buffer.from(encrypted, 'base64').length).toBeGreaterThan(0);
    });

    it('should produce ciphertext with correct structure (IV + AuthTag + Encrypted)', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const payload = Buffer.from(encrypted, 'base64');

      const IV_LENGTH = 12;
      const AUTH_TAG_LENGTH = 16;
      const minimumLength = IV_LENGTH + AUTH_TAG_LENGTH;

      expect(payload.length).toBeGreaterThanOrEqual(minimumLength);
    });
  });

  describe('decryptAmount', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should throw on tampered ciphertext (modified payload)', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const payload = Buffer.from(encrypted, 'base64');

      payload[payload.length - 1] ^= 0xff;
      const tamperedEncrypted = payload.toString('base64');

      expect(() => service.decryptAmount(tamperedEncrypted, dek)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const payload = Buffer.from(encrypted, 'base64');

      const IV_LENGTH = 12;
      payload[IV_LENGTH] ^= 0xff;
      const tamperedEncrypted = payload.toString('base64');

      expect(() => service.decryptAmount(tamperedEncrypted, dek)).toThrow();
    });

    it('should throw on invalid base64 input', () => {
      const dek = randomBytes(32);

      expect(() => service.decryptAmount('not-valid-base64!!!', dek)).toThrow();
    });

    it('should throw when using wrong DEK', () => {
      const dek1 = randomBytes(32);
      const dek2 = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek1);

      expect(() => service.decryptAmount(encrypted, dek2)).toThrow();
    });
  });

  describe('tryDecryptAmount', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should return decrypted value on success', () => {
      const dek = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const result = service.tryDecryptAmount(encrypted, dek, 0);

      expect(result).toBe(amount);
    });

    it('should return fallback without logging the raw decryption error', () => {
      const dek = randomBytes(32);
      const fallback = 999.99;
      const warn = mock(() => {});
      const logger = { ...createMockLogger(), warn };
      service = new AesGcmCryptoService(
        logger as any,
        mockConfigService as any,
        mockRepository as any,
      );
      const decryptSpy = spyOn(service, 'decryptAmount').mockImplementation(
        () => {
          const error = new Error('CRYPTO_LOG_SENTINEL');
          error.name = 'CryptoFailure';
          throw error;
        },
      );

      const result = service.tryDecryptAmount('corrupted-data', dek, fallback);

      expect(result).toBe(fallback);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'CryptoFailure' }),
        expect.any(String),
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(
        'CRYPTO_LOG_SENTINEL',
      );
      decryptSpy.mockRestore();
    });

    it('should return 0 fallback when decryption fails and fallback is 0', () => {
      const dek1 = randomBytes(32);
      const dek2 = randomBytes(32);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek1);
      const result = service.tryDecryptAmount(encrypted, dek2, 0);

      expect(result).toBe(0);
    });

    it('should return non-zero fallback when decryption fails (transition mode)', () => {
      const dek1 = randomBytes(32);
      const dek2 = randomBytes(32);
      const amount = 1234.56;
      const fallback = 42.5;

      const encrypted = service.encryptAmount(amount, dek1);
      const result = service.tryDecryptAmount(encrypted, dek2, fallback);

      expect(result).toBe(fallback);
    });
  });

  describe('decryptRowAmountFields', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should decrypt amount and original_amount', () => {
      const dek = randomBytes(32);
      const encAmt = service.encryptAmount(100, dek);
      const encOrig = service.encryptAmount(50, dek);
      const row = {
        id: 'x',
        amount: encAmt,
        original_amount: encOrig,
      };
      const out = service.decryptRowAmountFields(row, dek);
      expect(out.amount).toBe(100);
      expect(out.original_amount).toBe(50);
      expect(out.id).toBe('x');
    });

    it('should use 0 and null when ciphertext columns are empty', () => {
      const dek = randomBytes(32);
      const row = { id: 'y', amount: null, original_amount: null };
      const out = service.decryptRowAmountFields(row, dek);
      expect(out.amount).toBe(0);
      expect(out.original_amount).toBeNull();
    });
  });

  describe('ensureUserDEK', () => {
    it('should create the missing salt but reject writes until the vault is initialized', async () => {
      const generatedSalt = randomBytes(16).toString('hex');
      let findCallCount = 0;
      const findSaltByUserId = mock(() => {
        findCallCount++;
        // First call: no salt exists. Second call (after upsert): return the salt
        if (findCallCount === 1) return Promise.resolve(null);
        return Promise.resolve({
          salt: generatedSalt,
          kdf_iterations: 600000,
          key_check: null,
        });
      });
      const upsertSalt = mock(() => Promise.resolve());

      const repo = createMockRepository({ findSaltByUserId, upsertSalt });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(upsertSalt).toHaveBeenCalled();
    });

    it('should reject writes when an existing salt has no key check', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
    });

    it('should throw BusinessException without leaking userId when salt re-read returns null after upsert', async () => {
      // Simulates a pathological race where the second findSaltByUserId
      // (post-upsert read) returns null. Service must throw a structured
      // BusinessException with userId only in loggingContext, never in message.
      const findSaltByUserId = mock(() => Promise.resolve(null));
      const upsertSalt = mock(() => Promise.resolve());

      const repo = createMockRepository({ findSaltByUserId, upsertSalt });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR.code,
        );
        expect((error as BusinessException).message).not.toContain(
          TEST_USER_ID,
        );
        expect((error as BusinessException).loggingContext).toMatchObject({
          userId: TEST_USER_ID,
          operation: 'ensure_salt.race_lost',
        });
      }
    });

    it('should revalidate a cached DEK outside an HTTP request', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));

      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek1 = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const dek2 = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek1).toEqual(dek2);
      expect(findSaltByUserId.mock.calls.length).toBe(2);
    });

    it('should derive same DEK for same clientKey and salt', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));

      const repo = createMockRepository({ findSaltByUserId });

      const service1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );
      const service2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek1 = await service1.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const dek2 = await service2.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek1).toEqual(dek2);
    });

    it('should reject a different client key for the configured vault', async () => {
      const clientKey1 = randomBytes(32);
      const clientKey2 = randomBytes(32);
      const row = await buildConfiguredRow(clientKey1);
      const findSaltByUserId = mock(() => Promise.resolve(row));

      const repo = createMockRepository({ findSaltByUserId });

      const service1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );
      const service2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek1 = await service1.ensureUserDEK(TEST_USER_ID, clientKey1);
      expect(dek1.length).toBe(32);
      await expect(
        service2.ensureUserDEK(TEST_USER_ID, clientKey2),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
    });

    it('should return DEK when key_check is valid', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(service.validateKeyCheck(row.key_check, result)).toBe(true);
    });

    it('should throw ENCRYPTION_KEY_CHECK_FAILED when key_check mismatches', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrongDek = randomBytes(32);

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
      const invalidKeyCheck = service.generateKeyCheck(wrongDek);

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: invalidKeyCheck,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should fail closed when key_check is null', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
    });

    it('should evict and reject a cached DEK invalidated by a remote rekey', async () => {
      const row = await buildConfiguredRow();
      const wrongDek = randomBytes(32);

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
      const invalidKeyCheck = service.generateKeyCheck(wrongDek);

      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      findSaltByUserId.mockImplementation(() =>
        Promise.resolve({
          ...row,
          kdf_iterations: 600000,
          key_check: invalidKeyCheck,
        }),
      );

      await expect(
        service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(findSaltByUserId.mock.calls.length).toBe(2);
      expect(dek.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe('getUserDEK', () => {
    it('should throw when user has no salt', async () => {
      const findSaltByUserId = mock(() => Promise.resolve(null));

      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
        // userId must NOT leak to client message — only loggingContext
        expect((error as BusinessException).message).not.toContain(
          TEST_USER_ID,
        );
        expect((error as BusinessException).loggingContext).toMatchObject({
          userId: TEST_USER_ID,
          operation: 'getUserDEK.no_key_row',
        });
      }
    });

    it('should derive DEK from existing salt', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek = await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(dek).toBeDefined();
      expect(dek.length).toBe(32);
    });
  });

  describe('getUserSalt', () => {
    it('should return existing salt, iterations, and hasRecoveryKey=false when no recovery key', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const hasRecoveryKey = mock(() => Promise.resolve(false));

      const repo = createMockRepository({ findSaltByUserId, hasRecoveryKey });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getUserSalt(TEST_USER_ID);
      expect(result.salt).toBe(existingSalt);
      expect(result.kdfIterations).toBe(600000);
      expect(result.hasRecoveryKey).toBe(false);
    });

    it('should return hasRecoveryKey=true when user has recovery key', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const hasRecoveryKey = mock(() => Promise.resolve(true));

      const repo = createMockRepository({ findSaltByUserId, hasRecoveryKey });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getUserSalt(TEST_USER_ID);
      expect(result.salt).toBe(existingSalt);
      expect(result.kdfIterations).toBe(600000);
      expect(result.hasRecoveryKey).toBe(true);
    });

    it('should generate and persist new salt when none exists', async () => {
      const generatedSalt = randomBytes(16).toString('hex');
      let callCount = 0;
      const findSaltByUserId = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(null);
        return Promise.resolve({
          salt: generatedSalt,
          kdf_iterations: 600000,
          key_check: null,
        });
      });
      const upsertSalt = mock(() => Promise.resolve());
      const hasRecoveryKey = mock(() => Promise.resolve(false));

      const repo = createMockRepository({
        findSaltByUserId,
        upsertSalt,
        hasRecoveryKey,
      });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getUserSalt(TEST_USER_ID);
      expect(result.salt).toBeDefined();
      expect(result.salt.length).toBe(32); // 16 bytes hex = 32 chars
      expect(result.kdfIterations).toBe(600000);
      expect(result.hasRecoveryKey).toBe(false);
      expect(upsertSalt).toHaveBeenCalled();
    });
  });

  describe('findSaltByUserId error propagation', () => {
    it('should propagate non-PGRST116 repository errors in ensureUserDEK', async () => {
      const findSaltByUserId = mock(() =>
        Promise.reject(
          new Error(
            'Failed to fetch encryption key for user test: connection error',
          ),
        ),
      );

      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('connection error');
      }
    });
  });

  describe('getVaultStatus', () => {
    it('should return all flags false when no row exists', async () => {
      const getVaultStatus = mock(() =>
        Promise.resolve({
          pinCodeConfigured: false,
          recoveryKeyConfigured: false,
          vaultCodeConfigured: false,
        }),
      );
      const repo = createMockRepository({ getVaultStatus });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getVaultStatus(TEST_USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: false,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      });
      expect(getVaultStatus).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should return pin-only state when key_check exists and wrapped_dek is null', async () => {
      const getVaultStatus = mock(() =>
        Promise.resolve({
          pinCodeConfigured: true,
          recoveryKeyConfigured: false,
          vaultCodeConfigured: false,
        }),
      );
      const repo = createMockRepository({ getVaultStatus });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getVaultStatus(TEST_USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: true,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      });
    });

    it('should return recovery-only state when wrapped_dek exists and key_check is null', async () => {
      const getVaultStatus = mock(() =>
        Promise.resolve({
          pinCodeConfigured: false,
          recoveryKeyConfigured: true,
          vaultCodeConfigured: false,
        }),
      );
      const repo = createMockRepository({ getVaultStatus });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getVaultStatus(TEST_USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: false,
        recoveryKeyConfigured: true,
        vaultCodeConfigured: false,
      });
    });

    it('should return all flags true when both key_check and wrapped_dek are set', async () => {
      const getVaultStatus = mock(() =>
        Promise.resolve({
          pinCodeConfigured: true,
          recoveryKeyConfigured: true,
          vaultCodeConfigured: true,
        }),
      );
      const repo = createMockRepository({ getVaultStatus });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.getVaultStatus(TEST_USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: true,
        recoveryKeyConfigured: true,
        vaultCodeConfigured: true,
      });
      expect(getVaultStatus).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe('integration tests', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should encrypt and decrypt with derived DEK end-to-end', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const dek = await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });
  });

  describe('generateRecoveryKey', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should generate a 32-byte raw key', () => {
      const { raw } = service.generateRecoveryKey();
      expect(raw.length).toBe(32);
    });

    it('should return a formatted base32 string with dashes', () => {
      const { formatted } = service.generateRecoveryKey();
      expect(formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
    });

    it('should generate different keys on each call', () => {
      const key1 = service.generateRecoveryKey();
      const key2 = service.generateRecoveryKey();
      expect(key1.formatted).not.toBe(key2.formatted);
    });
  });

  describe('wrapDEK and unwrapDEK', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should roundtrip wrap and unwrap DEK', () => {
      const dek = randomBytes(32);
      const recoveryKey = randomBytes(32);

      const wrapped = service.wrapDEK(dek, recoveryKey);
      const unwrapped = service.unwrapDEK(wrapped, recoveryKey);

      expect(unwrapped).toEqual(dek);
    });

    it('should produce base64 encoded wrapped DEK', () => {
      const dek = randomBytes(32);
      const recoveryKey = randomBytes(32);

      const wrapped = service.wrapDEK(dek, recoveryKey);

      expect(() => Buffer.from(wrapped, 'base64')).not.toThrow();
    });

    it('should fail unwrap with wrong recovery key', () => {
      const dek = randomBytes(32);
      const recoveryKey1 = randomBytes(32);
      const recoveryKey2 = randomBytes(32);

      const wrapped = service.wrapDEK(dek, recoveryKey1);

      expect(() => service.unwrapDEK(wrapped, recoveryKey2)).toThrow();
    });

    it('should fail unwrap with tampered wrapped DEK', () => {
      const dek = randomBytes(32);
      const recoveryKey = randomBytes(32);

      const wrapped = service.wrapDEK(dek, recoveryKey);
      const payload = Buffer.from(wrapped, 'base64');
      payload[payload.length - 1] ^= 0xff;
      const tampered = payload.toString('base64');

      expect(() => service.unwrapDEK(tampered, recoveryKey)).toThrow();
    });
  });

  describe('generateKeyCheck', () => {
    it('should encrypt value 0 and return base64 string', () => {
      const dek = randomBytes(32);
      const keyCheck = service.generateKeyCheck(dek);

      expect(typeof keyCheck).toBe('string');
      expect(keyCheck.length).toBeGreaterThan(0);
      // Base64 pattern validation
      expect(keyCheck).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should produce consistent key_check for same DEK', () => {
      const dek = randomBytes(32);
      const keyCheck1 = service.generateKeyCheck(dek);
      const keyCheck2 = service.generateKeyCheck(dek);

      // Different due to random IV, but both should be valid
      expect(keyCheck1).not.toBe(keyCheck2);
      // Both should decrypt successfully
      expect(service.validateKeyCheck(keyCheck1, dek)).toBe(true);
      expect(service.validateKeyCheck(keyCheck2, dek)).toBe(true);
    });

    it('should produce different key_checks for different DEKs', () => {
      const dek1 = randomBytes(32);
      const dek2 = randomBytes(32);
      const keyCheck1 = service.generateKeyCheck(dek1);
      const keyCheck2 = service.generateKeyCheck(dek2);

      // Cannot decrypt with wrong DEK
      expect(service.validateKeyCheck(keyCheck1, dek2)).toBe(false);
      expect(service.validateKeyCheck(keyCheck2, dek1)).toBe(false);
    });
  });

  describe('validateKeyCheck', () => {
    it('should return true when key_check decrypts successfully', () => {
      const dek = randomBytes(32);
      const keyCheck = service.generateKeyCheck(dek);

      expect(service.validateKeyCheck(keyCheck, dek)).toBe(true);
    });

    it('should return false when key_check is tampered', () => {
      const dek = randomBytes(32);
      const keyCheck = service.generateKeyCheck(dek);

      // Tamper with the key_check
      const tamperedKeyCheck = `${keyCheck.slice(0, -4)}XXXX`;

      expect(service.validateKeyCheck(tamperedKeyCheck, dek)).toBe(false);
    });

    it('should return false when wrong DEK is used', () => {
      const dek1 = randomBytes(32);
      const dek2 = randomBytes(32);
      const keyCheck = service.generateKeyCheck(dek1);

      expect(service.validateKeyCheck(keyCheck, dek2)).toBe(false);
    });
  });

  describe('verifyExistingKeyCheck', () => {
    it('should validate existing key_check and return true', async () => {
      const existingSalt = randomBytes(16).toString('hex');

      // First, create service to derive the DEK and generate valid keyCheck
      const initialFindSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const initialRepo = createMockRepository({
        findSaltByUserId: initialFindSaltByUserId,
      });
      const initialService = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        initialRepo as any,
      );
      const dek = await initialService.getUserDEK(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      const validKeyCheck = initialService.generateKeyCheck(dek);

      // Now create the actual test with the valid keyCheck
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId, findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.verifyExistingKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(result).toBe(true);
      expect(findByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should return false when existing key_check fails validation', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrongDek = randomBytes(32);
      const invalidKeyCheck = service.generateKeyCheck(wrongDek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: invalidKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId, findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.verifyExistingKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(result).toBe(false);
    });

    it('should fail closed without creating key_check when missing', async () => {
      const existingSalt = randomBytes(16).toString('hex');

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateKeyCheckIfNull = mock((_userId: string, _keyCheck: string) =>
        Promise.resolve(),
      );

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateKeyCheckIfNull: updateKeyCheckIfNull as ReturnType<typeof mock>,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.verifyExistingKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(result).toBe(false);
      expect(updateKeyCheckIfNull).not.toHaveBeenCalled();
    });

    it('should propagate repository errors on findByUserId failure', async () => {
      const findByUserId = mock(() =>
        Promise.reject(new Error('Database connection failed')),
      );

      const repo = createMockRepository({ findByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.verifyExistingKeyCheck(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('validated-DEK-only cache invariant', () => {
    const buildRowWithCanaryFor = async (clientKey: Buffer) => {
      const existingSalt = randomBytes(16).toString('hex');
      const bootstrapRepo = createMockRepository({
        findSaltByUserId: mock(() =>
          Promise.resolve({
            salt: existingSalt,
            kdf_iterations: 600000,
            key_check: null,
          }),
        ),
      });
      const bootstrapService = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        bootstrapRepo as any,
      );
      const dek = await bootstrapService.getUserDEK(TEST_USER_ID, clientKey);
      const validKeyCheck = bootstrapService.generateKeyCheck(dek);
      return {
        salt: existingSalt,
        kdf_iterations: 600000,
        wrapped_dek: null,
        key_check: validKeyCheck,
      };
    };

    it('should not cache the DEK when verifyExistingKeyCheck fails — subsequent write rejects the key', async () => {
      const row = await buildRowWithCanaryFor(TEST_CLIENT_KEY);
      const wrongClientKey = randomBytes(32);
      const repo = createMockRepository({
        findByUserId: mock(() => Promise.resolve(row)),
        findSaltByUserId: mock(() => Promise.resolve(row)),
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const verified = await service.verifyExistingKeyCheck(
        TEST_USER_ID,
        wrongClientKey,
      );

      expect(verified).toBe(false);
      try {
        await service.ensureUserDEK(TEST_USER_ID, wrongClientKey);
        expect.unreachable(
          'ensureUserDEK must re-derive and reject the wrong key, not hit a poisoned cache',
        );
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should keep populating the cache on successful verifyExistingKeyCheck', async () => {
      const row = await buildRowWithCanaryFor(TEST_CLIENT_KEY);
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({
        findByUserId: mock(() => Promise.resolve(row)),
        findSaltByUserId,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const verified = await service.verifyExistingKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(verified).toBe(true);
      expect(dek.length).toBe(32);
      expect(findSaltByUserId).toHaveBeenCalledTimes(1);
    });

    it('should reuse one fresh validation within the same HTTP request', async () => {
      const row = await buildRowWithCanaryFor(TEST_CLIENT_KEY);
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const requestContext = new Map<string, unknown>();
      const cls = {
        isActive: () => true,
        get: (key: string) => requestContext.get(key),
        set: (key: string, value: unknown) => requestContext.set(key, value),
      };
      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
        cls as any,
      );

      await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      await service.prepareAmountsData(
        [100, 200],
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(findSaltByUserId).toHaveBeenCalledTimes(1);
    });

    it('should let reads fall back on a wrong key without poisoning the cache for writes', async () => {
      const row = await buildRowWithCanaryFor(TEST_CLIENT_KEY);
      const wrongClientKey = randomBytes(32);
      const repo = createMockRepository({
        findSaltByUserId: mock(() => Promise.resolve(row)),
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const readDek = await service.getDekFor({
        id: TEST_USER_ID,
        clientKey: wrongClientKey,
      });

      expect(readDek.length).toBe(32);
      try {
        await service.ensureUserDEK(TEST_USER_ID, wrongClientKey);
        expect.unreachable(
          'a read with a stale key must not let a concurrent write encrypt under the wrong DEK',
        );
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should not cache an unverified DEK when key_check is missing', async () => {
      const row = {
        salt: randomBytes(16).toString('hex'),
        kdf_iterations: 600000,
        key_check: null,
      };
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const readDek = await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(readDek.length).toBe(32);

      await expect(
        service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(findSaltByUserId).toHaveBeenCalledTimes(2);
    });

    it('should reject createRecoveryKey with a wrong key before wrapping anything', async () => {
      const row = await buildRowWithCanaryFor(TEST_CLIENT_KEY);
      const wrongClientKey = randomBytes(32);
      const updateWrappedDEKIfNull = mock(() => Promise.resolve(true));
      const repo = createMockRepository({
        findSaltByUserId: mock(() => Promise.resolve(row)),
        updateWrappedDEKIfNull,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.createRecoveryKey(
          TEST_USER_ID,
          wrongClientKey,
          createEmptyEncryptedDataClient() as any,
        );
        expect.unreachable(
          'a recovery key must never wrap a DEK that failed the canary',
        );
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
      expect(updateWrappedDEKIfNull).not.toHaveBeenCalled();
    });
  });

  describe('prepareAmountData', () => {
    it('should return encrypted string as amount', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const amount = 1234.56;
      const result = await service.prepareAmountData(
        amount,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(typeof result.amount).toBe('string');
      expect(result.amount.length).toBeGreaterThan(0);
    });

    it('should produce encrypted value that can be decrypted back to original amount', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const amount = 1234.56;
      const result = await service.prepareAmountData(
        amount,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const decrypted = service.decryptAmount(result.amount, dek);

      expect(decrypted).toBe(amount);
    });

    it('should handle zero amount correctly', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.prepareAmountData(
        0,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(typeof result.amount).toBe('string');

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const decrypted = service.decryptAmount(result.amount, dek);
      expect(decrypted).toBe(0);
    });
  });

  describe('prepareAmountsData', () => {
    it('should return encrypted strings as amounts', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const amounts = [100.5, 200.75, 300.25];
      const results = await service.prepareAmountsData(
        amounts,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(results.length).toBe(amounts.length);
      results.forEach((result) => {
        expect(typeof result.amount).toBe('string');
        expect(result.amount.length).toBeGreaterThan(0);
      });
    });

    it('should produce encrypted values that can be decrypted back to original amounts', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const amounts = [100.5, 200.75, 300.25];
      const results = await service.prepareAmountsData(
        amounts,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      results.forEach((result, index) => {
        const decrypted = service.decryptAmount(result.amount, dek);
        expect(decrypted).toBe(amounts[index]);
      });
    });

    it('should handle empty array', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const results = await service.prepareAmountsData(
        [],
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(results).toEqual([]);
    });

    it('should handle single amount', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const repo = createMockRepository({ findSaltByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const amounts = [1234.56];
      const results = await service.prepareAmountsData(
        amounts,
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(results.length).toBe(1);
      expect(typeof results[0].amount).toBe('string');
    });
  });

  describe('unwrapDEK', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should unwrap DEK with valid recovery key', () => {
      const dek = randomBytes(32);
      const recoveryKey = randomBytes(32);

      const wrappedDEK = service.wrapDEK(dek, recoveryKey);
      const unwrappedDEK = service.unwrapDEK(wrappedDEK, recoveryKey);

      expect(unwrappedDEK).toEqual(dek);
    });

    it('should throw on invalid recovery key', () => {
      const dek = randomBytes(32);
      const validRecoveryKey = randomBytes(32);
      const invalidRecoveryKey = randomBytes(32);

      const wrappedDEK = service.wrapDEK(dek, validRecoveryKey);

      expect(() => service.unwrapDEK(wrappedDEK, invalidRecoveryKey)).toThrow();
    });

    it('should throw on tampered wrapped DEK', () => {
      const dek = randomBytes(32);
      const recoveryKey = randomBytes(32);

      const wrappedDEK = service.wrapDEK(dek, recoveryKey);
      const payload = Buffer.from(wrappedDEK, 'base64');
      payload[payload.length - 1] ^= 0xff;
      const tamperedWrappedDEK = payload.toString('base64');

      expect(() =>
        service.unwrapDEK(tamperedWrappedDEK, recoveryKey),
      ).toThrow();
    });
  });

  describe('createRecoveryKey', () => {
    it('should atomically initialize key_check and wrapped_dek for an empty vault', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(
        (_userId: string, _keyCheck: string, _wrappedDEK: string) =>
          Promise.resolve(true),
      );
      const updateWrappedDEKIfNull = mock(() => Promise.resolve(true));
      const updateKeyCheckIfNull = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        initializeVaultIfEmpty,
        updateWrappedDEKIfNull,
        updateKeyCheckIfNull,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.createRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
        createEmptyEncryptedDataClient() as any,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(initializeVaultIfEmpty).toHaveBeenCalledTimes(1);
      expect(initializeVaultIfEmpty.mock.calls[0]?.[0]).toBe(TEST_USER_ID);
      expect(typeof initializeVaultIfEmpty.mock.calls[0]?.[1]).toBe('string');
      expect(typeof initializeVaultIfEmpty.mock.calls[0]?.[2]).toBe('string');
      expect(updateWrappedDEKIfNull).not.toHaveBeenCalled();
      expect(updateKeyCheckIfNull).not.toHaveBeenCalled();
    });

    it('should throw RECOVERY_KEY_ALREADY_EXISTS when the atomic initialization race is lost', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(false));

      const repo = createMockRepository({
        findSaltByUserId,
        initializeVaultIfEmpty,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEmptyEncryptedDataClient() as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_ALREADY_EXISTS.code,
        );
      }
    });

    it('should refuse a recovery-only legacy vault without mutating it', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: 'existing-wrapped-dek',
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(true));
      const repo = createMockRepository({
        findByUserId,
        initializeVaultIfEmpty,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEmptyEncryptedDataClient() as any,
        ),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(initializeVaultIfEmpty).not.toHaveBeenCalled();
    });

    it('should refuse bootstrap when encrypted user data already exists', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(true));
      const repo = createMockRepository({
        findByUserId,
        initializeVaultIfEmpty,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await expect(
        service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEncryptedDataClient({
            monthly_budget: [
              { id: 'budget-1', ending_balance: 'existing-ciphertext' },
            ],
          }) as any,
        ),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(initializeVaultIfEmpty).not.toHaveBeenCalled();
    });

    it('should refuse bootstrap when encrypted data exists after the first 1,000 rows', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(true));
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({
          findByUserId,
          initializeVaultIfEmpty,
        }) as any,
      );
      const monthlyBudgets = Array.from({ length: 1_001 }, (_, index) => ({
        id: testUuid(index),
        user_id: TEST_USER_ID,
        ending_balance: index === 1_000 ? 'existing-ciphertext' : null,
      }));

      await expect(
        service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEncryptedDataClient({
            monthly_budget: monthlyBudgets,
          }) as any,
        ),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      });
      expect(initializeVaultIfEmpty).not.toHaveBeenCalled();
    });

    it('should fail closed when checking encrypted data fails', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(true));
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({
          findByUserId,
          initializeVaultIfEmpty,
        }) as any,
      );

      await expect(
        service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEncryptedDataClient(
            {},
            { 0: new Error('query failed') },
          ) as any,
        ),
      ).rejects.toThrow('query failed');
      expect(initializeVaultIfEmpty).not.toHaveBeenCalled();
    });

    it('should fail closed when an existence query returns null data without an error', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const initializeVaultIfEmpty = mock(() => Promise.resolve(true));
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({
          findByUserId,
          initializeVaultIfEmpty,
        }) as any,
      );

      await expect(
        service.createRecoveryKey(
          TEST_USER_ID,
          TEST_CLIENT_KEY,
          createEncryptedDataClient({}, {}, new Set([0])) as any,
        ),
      ).rejects.toThrow('Ambiguous Supabase response');
      expect(initializeVaultIfEmpty).not.toHaveBeenCalled();
    });
  });

  describe('reEncryptAllUserData', () => {
    it('should include plan-only withdrawals in the atomic rekey payload', async () => {
      const oldDek = randomBytes(32);
      const newDek = randomBytes(32);
      const rekeyUserData = mock(() => Promise.resolve());
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({ rekeyUserData }) as any,
      );
      const ciphertext = service.encryptAmount(4_500, oldDek);

      await service.reEncryptAllUserData(
        TEST_USER_ID,
        oldDek,
        newDek,
        createEncryptedDataClient({
          savings_goal_plan_withdrawal: [
            { id: testUuid(9_001), user_id: TEST_USER_ID, amount: ciphertext },
          ],
        }) as any,
      );

      const [, payloads] = rekeyUserData.mock.calls[0] as unknown as [
        string,
        { planWithdrawals: Array<{ id: string; amount: string }> },
      ];
      expect(payloads.planWithdrawals).toHaveLength(1);
      expect(
        service.decryptAmount(payloads.planWithdrawals[0]!.amount, newDek),
      ).toBe(4_500);
    });

    it('should read and re-encrypt all rows beyond the PostgREST 1,000-row limit', async () => {
      const oldDek = randomBytes(32);
      const newDek = randomBytes(32);
      const logger = {
        ...createMockLogger(),
        info: mock(() => {}),
      };
      const rekeyUserData = mock(() => Promise.resolve());
      service = new AesGcmCryptoService(
        logger as any,
        mockConfigService as any,
        createMockRepository({ rekeyUserData }) as any,
      );
      const ciphertext = service.encryptAmount(42, oldDek);
      const monthlyBudgets = Array.from({ length: 1_001 }, (_, index) => ({
        id: testUuid(index),
        user_id: TEST_USER_ID,
        ending_balance: ciphertext,
      }));
      const client = createEncryptedDataClient({
        monthly_budget: monthlyBudgets,
      });

      await service.reEncryptAllUserData(
        TEST_USER_ID,
        oldDek,
        newDek,
        client as any,
      );

      expect(rekeyUserData).toHaveBeenCalledTimes(1);
      const [calledUserId, payloads] = rekeyUserData.mock
        .calls[0] as unknown as [
        string,
        { monthlyBudgets: Array<{ id: string; ending_balance: string }> },
      ];
      expect(calledUserId).toBe(TEST_USER_ID);
      expect(payloads.monthlyBudgets).toHaveLength(1_001);
      expect(
        service.decryptAmount(
          payloads.monthlyBudgets[1_000]!.ending_balance,
          newDek,
        ),
      ).toBe(42);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          counts: expect.objectContaining({ monthly_budget: 1_001 }),
        }),
        'All user data re-encrypted',
      );
    });

    it('should not call the atomic rekey RPC when a later page fails', async () => {
      const oldDek = randomBytes(32);
      const newDek = randomBytes(32);
      const rekeyUserData = mock(() => Promise.resolve());
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({ rekeyUserData }) as any,
      );
      const ciphertext = service.encryptAmount(42, oldDek);
      const monthlyBudgets = Array.from({ length: 1_001 }, (_, index) => ({
        id: testUuid(index),
        user_id: TEST_USER_ID,
        ending_balance: ciphertext,
      }));
      const client = createEncryptedDataClient(
        { monthly_budget: monthlyBudgets },
        { 1_000: new Error('second page failed') },
      );

      await expect(
        service.reEncryptAllUserData(
          TEST_USER_ID,
          oldDek,
          newDek,
          client as any,
        ),
      ).rejects.toThrow('second page failed');
      expect(rekeyUserData).not.toHaveBeenCalled();
    });

    it('should not call the atomic rekey RPC when a later page returns null data without an error', async () => {
      const oldDek = randomBytes(32);
      const newDek = randomBytes(32);
      const rekeyUserData = mock(() => Promise.resolve());
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository({ rekeyUserData }) as any,
      );
      const ciphertext = service.encryptAmount(42, oldDek);
      const monthlyBudgets = Array.from({ length: 1_001 }, (_, index) => ({
        id: testUuid(index),
        user_id: TEST_USER_ID,
        ending_balance: ciphertext,
      }));
      const client = createEncryptedDataClient(
        { monthly_budget: monthlyBudgets },
        {},
        new Set([1_000]),
      );

      await expect(
        service.reEncryptAllUserData(
          TEST_USER_ID,
          oldDek,
          newDek,
          client as any,
        ),
      ).rejects.toThrow('Ambiguous Supabase response');
      expect(rekeyUserData).not.toHaveBeenCalled();
    });
  });

  describe('regenerateRecoveryKey', () => {
    it('should regenerate recovery key even when one already exists', async () => {
      const row = {
        ...(await buildConfiguredRow()),
        wrapped_dek: 'existing-wrapped-dek',
      };
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const findByUserId = mock(() => Promise.resolve(row));
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.regenerateRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(updateWrappedDEK).toHaveBeenCalledTimes(1);
    });

    it('should create a recovery key for a configured vault without one', async () => {
      const row = await buildConfiguredRow();
      const findSaltByUserId = mock(() => Promise.resolve(row));
      const findByUserId = mock(() => Promise.resolve(row));
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const result = await service.regenerateRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(updateWrappedDEK).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyRecoveryKey', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should resolve when recovery key unwraps wrapped_dek', async () => {
      const dek = randomBytes(32);
      const { raw, formatted } = service.generateRecoveryKey();
      const wrapped = service.wrapDEK(dek, raw);
      raw.fill(0);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: wrapped,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findByUserId });
      const svc = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      await svc.verifyRecoveryKey(TEST_USER_ID, formatted);
    });

    it('should throw RECOVERY_KEY_NOT_CONFIGURED when wrapped_dek is null', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findByUserId });
      const svc = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await svc.verifyRecoveryKey(TEST_USER_ID, 'AAAA-BBBB');
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_NOT_CONFIGURED.code,
        );
      }
    });

    it('should throw RECOVERY_KEY_INVALID for wrong recovery key', async () => {
      const dek = randomBytes(32);
      const { formatted: wrongFormatted } = service.generateRecoveryKey();
      const { raw: actualWrapKey } = service.generateRecoveryKey();
      const wrapped = service.wrapDEK(dek, actualWrapKey);
      actualWrapKey.fill(0);
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: wrapped,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findByUserId });
      const svc = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await svc.verifyRecoveryKey(TEST_USER_ID, wrongFormatted);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });
  });

  describe('recoverWithKey', () => {
    beforeEach(() => {
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should throw when user has no recovery key configured', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: randomBytes(16).toString('hex'),
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const newClientKey = randomBytes(32);
      const recoveryKeyFormatted =
        'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM';

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          recoveryKeyFormatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_NOT_CONFIGURED.code,
        );
      }
    });

    it('should throw when recovery key format is invalid', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const dek = randomBytes(32);
      const validRecoveryKey = randomBytes(32);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: service.wrapDEK(dek, validRecoveryKey),
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const newClientKey = randomBytes(32);
      // Invalid recovery key (too short after base32 decode)
      const invalidRecoveryKey = 'AAAA-BBBB';

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          invalidRecoveryKey,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code,
        );
      }
    });

    it('should map AES-GCM auth failure on unwrapDEK to RECOVERY_KEY_INVALID', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const correctRecoveryKey = randomBytes(32);
      const dek = randomBytes(32);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          // wrapped_dek is valid, but caller will pass a different recovery key
          // → AES-GCM authTag fails → Node throws "Unsupported state or unable
          // to authenticate data". Service must translate to RECOVERY_KEY_INVALID
          // so the use-case never has to string-match Node's crypto error.
          wrapped_dek: service.wrapDEK(dek, correctRecoveryKey),
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      // 52 chars base32 → decodes to exactly 32 bytes (KEY_LENGTH).
      // Passes the length check, fails AES-GCM authTag verification on unwrap.
      const wrongRecoveryKeyFormatted =
        'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MNOP';

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          wrongRecoveryKeyFormatted,
          randomBytes(32),
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code,
        );
        // Cause chain preserves the original AES error for ops debugging
        expect((error as BusinessException).cause).toBeDefined();
      }
    });

    it('should nullify wrapped_dek before re-encryption to close reuse window', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEK = mock((_userId: string, value: string | null) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve();
      });
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      const clientKey = randomBytes(32);

      // First, create a recovery key so we get a valid formatted key and wrapped DEK
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        clientKey,
        createEmptyEncryptedDataClient() as any,
      );

      // The createRecoveryKey stored a wrappedDEK — capture it
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];
      expect(storedWrappedDek).not.toBeNull();

      // Now set up the recovery scenario
      const recoveryUpdates: Array<string | null> = [];
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      const updateWrappedDEK2 = mock(
        (_userId: string, value: string | null) => {
          recoveryUpdates.push(value);
          return Promise.resolve();
        },
      );

      const repo2 = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK: updateWrappedDEK2,
      });
      const svc2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo2 as any,
      );

      const newClientKey = randomBytes(32);
      const mockSupabase = {} as any;

      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockResolvedValue('mock-key-check');

      await svc2.recoverWithKey(
        TEST_USER_ID,
        formatted,
        newClientKey,
        mockSupabase,
      );

      reEncryptSpy.mockRestore();

      // First updateWrappedDEK call should be null (invalidation before re-encryption)
      expect(updateWrappedDEK2).toHaveBeenCalledTimes(2);
      expect(recoveryUpdates[0]).toBeNull();
      // Second call should be the new wrapped DEK
      expect(recoveryUpdates[1]).not.toBeNull();
      expect(typeof recoveryUpdates[1]).toBe('string');
    });

    it('should invalidate previous recovery key after regeneration', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      let wrappedDek: string | null = null;
      let keyCheck: string | null = null;

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: keyCheck,
        }),
      );
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: wrappedDek,
          key_check: keyCheck,
        }),
      );
      const updateWrappedDEK = mock((_userId: string, value: string | null) => {
        wrappedDek = value;
        return Promise.resolve();
      });
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        if (wrappedDek !== null) {
          return Promise.resolve(false);
        }
        wrappedDek = value;
        return Promise.resolve(true);
      });
      const initializeVaultIfEmpty = mock(
        (_userId: string, nextKeyCheck: string, value: string) => {
          if (keyCheck !== null || wrappedDek !== null) {
            return Promise.resolve(false);
          }
          keyCheck = nextKeyCheck;
          wrappedDek = value;
          return Promise.resolve(true);
        },
      );

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
        initializeVaultIfEmpty,
      });

      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const clientKey = randomBytes(32);
      const first = await service.createRecoveryKey(
        TEST_USER_ID,
        clientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const firstWrapped = wrappedDek;
      expect(firstWrapped).not.toBeNull();

      await service.regenerateRecoveryKey(TEST_USER_ID, clientKey);
      expect(wrappedDek).not.toBe(firstWrapped);

      const newClientKey = randomBytes(32);

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          first.formatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch {
        // Expected: old recovery key is invalidated after regeneration
      }
    });

    it('should restore wrapped_dek when re-encryption fails', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEK = mock((_userId: string, value: string | null) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve();
      });
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      const clientKey = randomBytes(32);
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        clientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];
      expect(storedWrappedDek).not.toBeNull();

      const recoveryUpdates: Array<string | null> = [];
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      const updateWrappedDEK2 = mock(
        (_userId: string, value: string | null) => {
          recoveryUpdates.push(value);
          return Promise.resolve();
        },
      );

      const repo2 = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK: updateWrappedDEK2,
      });
      const svc2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo2 as any,
      );

      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockRejectedValue(new Error('RPC failed'));

      const newClientKey = randomBytes(32);
      try {
        await svc2.recoverWithKey(
          TEST_USER_ID,
          formatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('RPC failed');
      }

      reEncryptSpy.mockRestore();

      // wrapped_dek nulled before re-encryption, then restored after failure
      expect(updateWrappedDEK2).toHaveBeenCalledTimes(2);
      expect(recoveryUpdates[0]).toBeNull();
      expect(recoveryUpdates[1]).toBe(storedWrappedDek);
    });

    it('should warn when best-effort restore of wrapped_dek fails after re-encryption failure', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEK = mock((_userId: string, value: string | null) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve();
      });
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      const clientKey = randomBytes(32);
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        clientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      let callCount = 0;
      const providerError = new Error('RECOVER_RESTORE_LOG_SENTINEL');
      providerError.name = 'DatabaseFailure';
      const updateWrappedDEK2 = mock(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(providerError);
        }
        return Promise.resolve();
      });

      const mockLogger = createMockLogger();
      const warnSpy = spyOn(mockLogger, 'warn');

      const repo2 = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK: updateWrappedDEK2,
      });
      const svc2 = new AesGcmCryptoService(
        mockLogger as any,
        mockConfigService as any,
        repo2 as any,
      );

      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockRejectedValue(new Error('RPC failed'));

      const newClientKey = randomBytes(32);
      try {
        await svc2.recoverWithKey(
          TEST_USER_ID,
          formatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('RPC failed');
      }

      reEncryptSpy.mockRestore();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          operation: 'recover.restore_wrapped_dek_failed',
          errorType: 'DatabaseFailure',
        }),
        expect.stringContaining('Failed to restore wrapped_dek'),
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
        'RECOVER_RESTORE_LOG_SENTINEL',
      );
    });

    it('should invalidate DEK cache after rekey succeeds (concurrent request repopulates mid-rekey)', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEK = mock((_userId: string, value: string | null) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve();
      });
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      // Bootstrap a wrapped DEK + recovery key via createRecoveryKey
      const bootstrapClientKey = randomBytes(32);
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        bootstrapClientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      const findSaltByUserId2 = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo2 = createMockRepository({
        findByUserId,
        findSaltByUserId: findSaltByUserId2,
      });
      const svc2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo2 as any,
      );

      // Simulate the vulnerability: a concurrent request repopulates the cache
      // with the OLD client-key DEK while reEncryptAllUserData is running.
      const oldClientKey = randomBytes(32);
      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockImplementation(async () => {
        await svc2.getUserDEK(TEST_USER_ID, oldClientKey);
        return 'mock-key-check';
      });

      const newClientKey = randomBytes(32);
      await svc2.recoverWithKey(
        TEST_USER_ID,
        formatted,
        newClientKey,
        {} as any,
      );

      reEncryptSpy.mockRestore();

      // After successful recovery, the cache must be empty: a subsequent read
      // for the old client-key MUST hit the DB again (cache miss).
      const callsBeforeProbe = findSaltByUserId2.mock.calls.length;
      await svc2.getUserDEK(TEST_USER_ID, oldClientKey);
      expect(findSaltByUserId2.mock.calls.length).toBe(callsBeforeProbe + 1);
    });

    it('should invalidate DEK cache after re-encryption succeeds even when wrap step fails', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEKBootstrap = mock(
        (_userId: string, value: string | null) => {
          wrappedDekUpdates.push(value);
          return Promise.resolve();
        },
      );
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      const bootstrapClientKey = randomBytes(32);
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK: updateWrappedDEKBootstrap,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        bootstrapClientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      const findSaltByUserId2 = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      // First call (nullify before rekey) succeeds, second call (write
      // newWrappedDEK after re-encryption) fails — simulates DB write failure
      // post-rekey.
      let writeCallCount = 0;
      const updateWrappedDEK = mock(() => {
        writeCallCount++;
        if (writeCallCount === 2) {
          return Promise.reject(new Error('DB write failed after rekey'));
        }
        return Promise.resolve();
      });

      const repo2 = createMockRepository({
        findByUserId,
        findSaltByUserId: findSaltByUserId2,
        updateWrappedDEK,
      });
      const svc2 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo2 as any,
      );

      // Concurrent request repopulates cache with old-clientKey DEK during
      // the rekey window — AFTER reEncryptAllUserData has rotated data.
      const oldClientKey = randomBytes(32);
      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockImplementation(async () => {
        await svc2.getUserDEK(TEST_USER_ID, oldClientKey);
        return 'mock-key-check';
      });

      const newClientKey = randomBytes(32);
      try {
        await svc2.recoverWithKey(
          TEST_USER_ID,
          formatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE.code,
        );
        expect(((error as BusinessException).cause as Error).message).toBe(
          'DB write failed after rekey',
        );
      }

      reEncryptSpy.mockRestore();

      // Cache MUST be empty even though the wrap write threw — data on disk
      // is already rotated to newDek; serving the old-DEK cache would corrupt
      // subsequent reads.
      const callsBeforeProbe = findSaltByUserId2.mock.calls.length;
      await svc2.getUserDEK(TEST_USER_ID, oldClientKey);
      expect(findSaltByUserId2.mock.calls.length).toBe(callsBeforeProbe + 1);
    });

    it('should throw ENCRYPTION_REKEY_PARTIAL_FAILURE when wrapDEK fails after re-encryption', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrappedDekUpdates: Array<string | null> = [];

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEKBootstrap = mock(
        (_userId: string, value: string | null) => {
          wrappedDekUpdates.push(value);
          return Promise.resolve();
        },
      );
      const updateWrappedDEKIfNull = mock((_userId: string, value: string) => {
        wrappedDekUpdates.push(value);
        return Promise.resolve(true);
      });

      const bootstrapClientKey = randomBytes(32);
      const repo1 = createMockRepository({
        findSaltByUserId,
        updateWrappedDEK: updateWrappedDEKBootstrap,
        updateWrappedDEKIfNull,
      });
      const svc1 = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo1 as any,
      );
      const { formatted } = await svc1.createRecoveryKey(
        TEST_USER_ID,
        bootstrapClientKey,
        createEmptyEncryptedDataClient() as any,
      );
      const storedWrappedDek = wrappedDekUpdates[wrappedDekUpdates.length - 1];

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: storedWrappedDek,
          key_check: null,
        }),
      );
      let callCount = 0;
      const nullifyError = new Error('RECOVER_NULLIFY_LOG_SENTINEL');
      nullifyError.name = 'DatabaseFailure';
      const updateWrappedDEK = mock(() =>
        ++callCount === 2 ? Promise.reject(nullifyError) : Promise.resolve(),
      );
      const mockLogger = createMockLogger();
      const warnSpy = spyOn(mockLogger, 'warn');

      const repo2 = createMockRepository({
        findByUserId,
        updateWrappedDEK,
      });
      const svc2 = new AesGcmCryptoService(
        mockLogger as any,
        mockConfigService as any,
        repo2 as any,
      );

      const reEncryptSpy = spyOn(
        svc2,
        'reEncryptAllUserData',
      ).mockResolvedValue('mock-key-check');

      // Force wrapDEK on svc2 to always throw — recoverWithKey only wraps once
      // (post-rekey). Bootstrap wrap happened on svc1, so this targets the
      // recovery wrap path unambiguously regardless of future call-order changes.
      const wrapSpy = spyOn(svc2, 'wrapDEK').mockImplementation(() => {
        throw new Error('AES-GCM wrap failed');
      });

      const newClientKey = randomBytes(32);
      try {
        await svc2.recoverWithKey(
          TEST_USER_ID,
          formatted,
          newClientKey,
          {} as any,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE.code,
        );
        expect(((error as BusinessException).cause as Error).message).toBe(
          'AES-GCM wrap failed',
        );
      }

      // wrapped_dek nullified twice: once before re-encryption, once after wrap
      // failure (best-effort cleanup mirroring changePinRekey).
      expect(updateWrappedDEK).toHaveBeenCalledTimes(2);
      const calls = updateWrappedDEK.mock.calls as unknown[][];
      expect(calls[0][1]).toBeNull(); // before re-encryption
      expect(calls[1][1]).toBeNull(); // after wrap failure
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'recover.nullify_wrapped_dek_failed',
          errorType: 'DatabaseFailure',
        }),
        expect.any(String),
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
        'RECOVER_NULLIFY_LOG_SENTINEL',
      );

      reEncryptSpy.mockRestore();
      wrapSpy.mockRestore();
    });
  });

  describe('changePinRekey', () => {
    const existingSalt = randomBytes(16).toString('hex');
    const oldClientKey = randomBytes(32);
    const newClientKey = randomBytes(32);
    const mockSupabase = {} as any;

    async function setupServiceWithValidKeyCheck(): Promise<Buffer> {
      // Bootstrap service to derive DEK and generate a valid keyCheck
      const bootstrapFindSalt = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const bootstrapRepo = createMockRepository({
        findSaltByUserId: bootstrapFindSalt,
      });
      const bootstrapService = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        bootstrapRepo as any,
      );
      return bootstrapService.getUserDEK(TEST_USER_ID, oldClientKey);
    }

    it('should throw ENCRYPTION_SAME_KEY when old and new keys are identical', async () => {
      const sameKey = randomBytes(32);

      // Must provide a valid row + key_check since findByUserId + key verification
      // now happens BEFORE the same-key check (prevents same-key oracle).
      const bootstrapRepo = createMockRepository({
        findSaltByUserId: mock(() =>
          Promise.resolve({
            salt: existingSalt,
            kdf_iterations: 600000,
            key_check: null,
          }),
        ),
      });
      const bootstrapService = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        bootstrapRepo as any,
      );
      const dek = await bootstrapService.getUserDEK(TEST_USER_ID, sameKey);
      const validKeyCheck = bootstrapService.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const repo = createMockRepository({ findByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          sameKey,
          Buffer.from(sameKey),
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_SAME_KEY.code,
        );
      }
    });

    it('should return ENCRYPTION_SAME_KEY even when key_check does not match (oracle prevention)', async () => {
      const sameKey = randomBytes(32);

      // key_check generated from a DIFFERENT DEK — would fail key verification
      const differentDek = randomBytes(32);
      const mismatchedKeyCheck = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository() as any,
      ).generateKeyCheck(differentDek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: mismatchedKeyCheck,
        }),
      );
      const repo = createMockRepository({ findByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          sameKey,
          Buffer.from(sameKey),
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_SAME_KEY.code,
        );
      }
    });

    it('should throw ENCRYPTION_KEY_CHECK_FAILED when old key is invalid', async () => {
      const wrongKey = randomBytes(32);
      const wrongDek = randomBytes(32);
      const invalidKeyCheck = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        createMockRepository() as any,
      ).generateKeyCheck(wrongDek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: invalidKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: invalidKeyCheck,
        }),
      );

      const repo = createMockRepository({ findByUserId, findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          wrongKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should re-encrypt data and always return a recovery key', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: 'new-key-check-from-rpc',
        }),
      );
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockResolvedValue('mock-key-check');

      const result = await service.changePinRekey(
        TEST_USER_ID,
        oldClientKey,
        newClientKey,
        mockSupabase,
      );

      expect(result.recoveryKey).not.toBeNull();
      expect(result.recoveryKey).toMatch(/^[A-Z2-7]+-/);
      expect(result.keyCheck).toBe('mock-key-check');
      expect(reEncryptSpy).toHaveBeenCalledTimes(1);
      expect(updateWrappedDEK).toHaveBeenCalledTimes(2);

      reEncryptSpy.mockRestore();
    });

    it('should re-wrap with new recovery key AFTER re-encryption when recovery exists', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);
      const callOrder: string[] = [];

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: 'some-wrapped-dek',
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: 'new-key-check-from-rpc',
        }),
      );
      const updateWrappedDEK = mock((userId: string, value: string | null) => {
        callOrder.push(
          `updateWrappedDEK:${value === null ? 'null' : 'wrapped'}`,
        );
        return Promise.resolve();
      });

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockImplementation(async () => {
        callOrder.push('reEncryptAllUserData');
        return 'mock-key-check';
      });

      const result = await service.changePinRekey(
        TEST_USER_ID,
        oldClientKey,
        newClientKey,
        mockSupabase,
      );

      expect(result.recoveryKey).not.toBeNull();
      expect(result.recoveryKey).toMatch(/^[A-Z2-7]+-/); // base32 formatted
      // Nullify BEFORE re-encryption, then wrap AFTER
      expect(updateWrappedDEK).toHaveBeenCalledTimes(2);
      expect(callOrder).toEqual([
        'updateWrappedDEK:null',
        'reEncryptAllUserData',
        'updateWrappedDEK:wrapped',
      ]);

      reEncryptSpy.mockRestore();
    });

    it('should nullify wrapped_dek before re-encryption even when re-encryption fails', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: 'some-wrapped-dek',
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: validKeyCheck,
        }),
      );
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockRejectedValue(new Error('RPC failed'));

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('RPC failed');
      }

      // wrapped_dek is nullified BEFORE re-encryption, then best-effort restored on failure
      expect(updateWrappedDEK).toHaveBeenCalledTimes(2);
      expect(updateWrappedDEK).toHaveBeenNthCalledWith(1, TEST_USER_ID, null);
      expect(updateWrappedDEK).toHaveBeenNthCalledWith(
        2,
        TEST_USER_ID,
        'some-wrapped-dek',
      );

      reEncryptSpy.mockRestore();
    });

    it('should warn when best-effort restore of wrapped_dek fails after rekey failure', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: 'some-wrapped-dek',
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: validKeyCheck,
        }),
      );
      let callCount = 0;
      const providerError = new Error('PIN_RESTORE_LOG_SENTINEL');
      providerError.name = 'DatabaseFailure';
      const updateWrappedDEK = mock(() => {
        callCount++;
        // First call (nullify) succeeds, second call (restore) fails
        if (callCount === 2) {
          return Promise.reject(providerError);
        }
        return Promise.resolve();
      });

      const mockLogger = createMockLogger();
      const warnSpy = spyOn(mockLogger, 'warn');

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        mockLogger as any,
        mockConfigService as any,
        repo as any,
      );

      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockRejectedValue(new Error('RPC failed'));

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('RPC failed');
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          operation: 'change_pin.restore_wrapped_dek_failed',
          errorType: 'DatabaseFailure',
        }),
        expect.stringContaining('Failed to restore wrapped_dek'),
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
        'PIN_RESTORE_LOG_SENTINEL',
      );

      reEncryptSpy.mockRestore();
    });

    it('should throw ENCRYPTION_KEY_CHECK_FAILED when key_check is null (not initialized)', async () => {
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should nullify wrapped_dek and throw REKEY_PARTIAL_FAILURE when recovery re-wrap fails', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: 'some-wrapped-dek',
          key_check: validKeyCheck,
        }),
      );
      let callCount = 0;
      const nullifyError = new Error('PIN_NULLIFY_LOG_SENTINEL');
      nullifyError.name = 'DatabaseFailure';
      const updateWrappedDEK = mock(() =>
        ++callCount === 2 ? Promise.reject(nullifyError) : Promise.resolve(),
      );
      const mockLogger = createMockLogger();
      const warnSpy = spyOn(mockLogger, 'warn');

      const repo = createMockRepository({
        findByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        mockLogger as any,
        mockConfigService as any,
        repo as any,
      );

      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockResolvedValue('mock-key-check');

      // Force wrapDEK to throw
      const wrapSpy = spyOn(service, 'wrapDEK').mockImplementation(() => {
        throw new Error('AES-GCM wrap failed');
      });

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE.code,
        );
      }

      // wrapped_dek nullified twice: once before re-encryption, once after wrap failure
      expect(updateWrappedDEK).toHaveBeenCalledTimes(2);
      const calls = updateWrappedDEK.mock.calls as unknown[][];
      expect(calls[0][1]).toBeNull(); // before re-encryption
      expect(calls[1][1]).toBeNull(); // after wrap failure (best-effort cleanup)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'change_pin.nullify_wrapped_dek_failed',
          errorType: 'DatabaseFailure',
        }),
        expect.any(String),
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
        'PIN_NULLIFY_LOG_SENTINEL',
      );

      reEncryptSpy.mockRestore();
      wrapSpy.mockRestore();
    });

    it('should throw ENCRYPTION_KEY_CHECK_FAILED when user has no encryption key', async () => {
      const findByUserId = mock(() => Promise.resolve(null));

      const repo = createMockRepository({ findByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should zero DEK buffers after successful re-encryption', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId, findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      let capturedOldDek: Buffer | undefined;
      let capturedNewDek: Buffer | undefined;
      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockImplementation(async (_userId, oldDek, newDek) => {
        capturedOldDek = oldDek;
        capturedNewDek = newDek;
        return 'mock-key-check';
      });

      await service.changePinRekey(
        TEST_USER_ID,
        oldClientKey,
        newClientKey,
        mockSupabase,
      );

      expect(capturedOldDek!.every((b) => b === 0)).toBe(true);
      expect(capturedNewDek!.every((b) => b === 0)).toBe(true);

      reEncryptSpy.mockRestore();
    });

    it('should zero DEK buffers even when re-encryption fails', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findByUserId, findSaltByUserId });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      let capturedOldDek: Buffer | undefined;
      let capturedNewDek: Buffer | undefined;
      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockImplementation(async (_userId, oldDek, newDek) => {
        capturedOldDek = oldDek;
        capturedNewDek = newDek;
        throw new Error('RPC failed');
      });

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown');
      } catch {
        // expected
      }

      expect(capturedOldDek!.every((b) => b === 0)).toBe(true);
      expect(capturedNewDek!.every((b) => b === 0)).toBe(true);

      reEncryptSpy.mockRestore();
    });

    it('should invalidate DEK cache after rekey succeeds (concurrent request repopulates mid-rekey)', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: validKeyCheck,
        }),
      );
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      // Simulate the vulnerability: a concurrent request repopulates the cache
      // with the OLD client-key DEK while reEncryptAllUserData is running.
      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockImplementation(async () => {
        await service.getUserDEK(TEST_USER_ID, oldClientKey);
        return 'mock-key-check';
      });

      await service.changePinRekey(
        TEST_USER_ID,
        oldClientKey,
        newClientKey,
        mockSupabase,
      );

      reEncryptSpy.mockRestore();

      // After successful rekey, the cache must be empty: a subsequent read
      // for the old client-key MUST hit the DB again (cache miss).
      const callsBeforeProbe = findSaltByUserId.mock.calls.length;
      await service.getUserDEK(TEST_USER_ID, oldClientKey);
      expect(findSaltByUserId.mock.calls.length).toBe(callsBeforeProbe + 1);
    });

    it('should invalidate DEK cache after re-encryption succeeds even when recovery wrap fails (PARTIAL_FAILURE)', async () => {
      const dek = await setupServiceWithValidKeyCheck();
      const validKeyCheck = service.generateKeyCheck(dek);

      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: null,
          key_check: validKeyCheck,
        }),
      );
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: validKeyCheck,
        }),
      );
      // Call 1: nullify (ok). Call 2: write new wrapped DEK (FAIL). Call 3:
      // best-effort nullify after wrap failure (ok).
      let writeCallCount = 0;
      const updateWrappedDEK = mock(() => {
        writeCallCount++;
        if (writeCallCount === 2) {
          return Promise.reject(new Error('DB write failed after rekey'));
        }
        return Promise.resolve();
      });

      const repo = createMockRepository({
        findByUserId,
        findSaltByUserId,
        updateWrappedDEK,
      });
      service = new AesGcmCryptoService(
        createMockLogger() as any,
        mockConfigService as any,
        repo as any,
      );

      // Concurrent request repopulates cache AFTER reEncryptAllUserData has
      // rotated data on disk.
      const reEncryptSpy = spyOn(
        service,
        'reEncryptAllUserData',
      ).mockImplementation(async () => {
        await service.getUserDEK(TEST_USER_ID, oldClientKey);
        return 'mock-key-check';
      });

      try {
        await service.changePinRekey(
          TEST_USER_ID,
          oldClientKey,
          newClientKey,
          mockSupabase,
        );
        expect.unreachable('Should have thrown PARTIAL_FAILURE');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE.code,
        );
      }

      reEncryptSpy.mockRestore();

      // Cache MUST be empty even though wrap step failed — data on disk is
      // already rotated to newDek; serving the cached old-DEK would corrupt
      // subsequent reads.
      const callsBeforeProbe = findSaltByUserId.mock.calls.length;
      await service.getUserDEK(TEST_USER_ID, oldClientKey);
      expect(findSaltByUserId.mock.calls.length).toBe(callsBeforeProbe + 1);
    });
  });
});
