import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { EncryptionService } from './encryption.service';

const TEST_MASTER_KEY = randomBytes(32).toString('hex');
const TEST_USER_ID = 'test-user-123';
const TEST_CLIENT_KEY = randomBytes(32);

const createMockConfigService = () => ({
  get: (key: string) => {
    if (key === 'ENCRYPTION_MASTER_KEY') return TEST_MASTER_KEY;
    return undefined;
  },
});

const createMockRepository = (overrides?: {
  findSaltByUserId?: ReturnType<typeof mock>;
  findByUserId?: ReturnType<typeof mock>;
  upsertSalt?: ReturnType<typeof mock>;
  updateWrappedDEK?: ReturnType<typeof mock>;
  updateWrappedDEKIfNull?: ReturnType<typeof mock>;
  hasRecoveryKey?: ReturnType<typeof mock>;
  updateKeyCheck?: ReturnType<typeof mock>;
  updateKeyCheckIfNull?: ReturnType<typeof mock>;
  hasVaultCode?: ReturnType<typeof mock>;
  getVaultStatus?: ReturnType<typeof mock>;
}) => ({
  findSaltByUserId:
    overrides?.findSaltByUserId ?? mock(() => Promise.resolve(null)),
  findByUserId: overrides?.findByUserId ?? mock(() => Promise.resolve(null)),
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
  updateKeyCheck: overrides?.updateKeyCheck ?? mock(() => Promise.resolve()),
  updateKeyCheckIfNull:
    overrides?.updateKeyCheckIfNull ??
    (overrides?.updateKeyCheck
      ? mock((userId: string, keyCheck: string) =>
          overrides.updateKeyCheck!(userId, keyCheck),
        )
      : mock(() => Promise.resolve())),
  hasVaultCode: overrides?.hasVaultCode ?? mock(() => Promise.resolve(false)),
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

describe('EncryptionService', () => {
  let service: EncryptionService;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockConfigService = createMockConfigService();
    mockRepository = createMockRepository();
  });

  describe('constructor', () => {
    it('should create service with valid ENCRYPTION_MASTER_KEY', () => {
      service = new EncryptionService(
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
        new EncryptionService(configWithoutKey as any, mockRepository as any);
      }).toThrow('ENCRYPTION_MASTER_KEY must be defined');
    });

    it('should throw error when ENCRYPTION_MASTER_KEY is empty string', () => {
      const configWithEmptyKey = {
        get: () => '',
      };
      expect(() => {
        new EncryptionService(configWithEmptyKey as any, mockRepository as any);
      }).toThrow('ENCRYPTION_MASTER_KEY must be defined');
    });
  });

  describe('encryptAmount and decryptAmount roundtrip', () => {
    beforeEach(() => {
      service = new EncryptionService(
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
      service = new EncryptionService(
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
      service = new EncryptionService(
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
      service = new EncryptionService(
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

    it('should return fallback on decryption failure', () => {
      const dek = randomBytes(32);
      const fallback = 999.99;

      const result = service.tryDecryptAmount('corrupted-data', dek, fallback);

      expect(result).toBe(fallback);
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

  describe('encryptAmounts', () => {
    beforeEach(() => {
      service = new EncryptionService(
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should encrypt multiple amounts', () => {
      const dek = randomBytes(32);
      const amounts = [100.5, 200.75, 300.25];

      const encrypted = service.encryptAmounts(amounts, dek);

      expect(encrypted.length).toBe(amounts.length);
      expect(encrypted.every((ct) => typeof ct === 'string')).toBe(true);
    });

    it('should handle empty array', () => {
      const dek = randomBytes(32);
      const amounts: number[] = [];

      const encrypted = service.encryptAmounts(amounts, dek);

      expect(encrypted).toEqual([]);
    });

    it('should handle single amount', () => {
      const dek = randomBytes(32);
      const amounts = [1234.56];

      const encrypted = service.encryptAmounts(amounts, dek);

      expect(encrypted.length).toBe(1);
    });
  });

  describe('decryptAmounts', () => {
    beforeEach(() => {
      service = new EncryptionService(
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should decrypt multiple amounts', () => {
      const dek = randomBytes(32);
      const amounts = [100.5, 200.75, 300.25];

      const encrypted = service.encryptAmounts(amounts, dek);
      const decrypted = service.decryptAmounts(encrypted, dek);

      expect(decrypted).toEqual(amounts);
    });

    it('should handle empty array', () => {
      const dek = randomBytes(32);
      const ciphertexts: string[] = [];

      const decrypted = service.decryptAmounts(ciphertexts, dek);

      expect(decrypted).toEqual([]);
    });

    it('should handle single ciphertext', () => {
      const dek = randomBytes(32);
      const amounts = [1234.56];

      const encrypted = service.encryptAmounts(amounts, dek);
      const decrypted = service.decryptAmounts(encrypted, dek);

      expect(decrypted).toEqual(amounts);
    });
  });

  describe('ensureUserDEK', () => {
    it('should derive DEK and create salt when none exists', async () => {
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

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek).toBeDefined();
      expect(dek.length).toBe(32);
      expect(upsertSalt).toHaveBeenCalled();
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

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek).toBeDefined();
      expect(dek.length).toBe(32);
    });

    it('should return cached DEK on second call', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek1 = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const dek2 = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek1).toEqual(dek2);
      expect(findSaltByUserId.mock.calls.length).toBe(1);
    });

    it('should derive same DEK for same clientKey and salt', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      const service1 = new EncryptionService(
        mockConfigService as any,
        repo as any,
      );
      const service2 = new EncryptionService(
        mockConfigService as any,
        repo as any,
      );

      const dek1 = await service1.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const dek2 = await service2.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      expect(dek1).toEqual(dek2);
    });

    it('should derive different DEK for different clientKeys', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      const clientKey1 = randomBytes(32);
      const clientKey2 = randomBytes(32);

      const service1 = new EncryptionService(
        mockConfigService as any,
        repo as any,
      );
      const service2 = new EncryptionService(
        mockConfigService as any,
        repo as any,
      );

      const dek1 = await service1.ensureUserDEK(TEST_USER_ID, clientKey1);
      const dek2 = await service2.ensureUserDEK(TEST_USER_ID, clientKey2);

      expect(dek1).not.toEqual(dek2);
    });

    it('should return DEK when key_check is valid', async () => {
      const existingSalt = randomBytes(16).toString('hex');

      // First, derive DEK to generate a valid key_check
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
      const initialService = new EncryptionService(
        mockConfigService as any,
        initialRepo as any,
      );
      const dek = await initialService.ensureUserDEK(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      const validKeyCheck = initialService.generateKeyCheck(dek);

      // Now test with valid key_check
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: validKeyCheck,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(result).toEqual(dek);
    });

    it('should throw ENCRYPTION_KEY_CHECK_FAILED when key_check mismatches', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrongDek = randomBytes(32);

      service = new EncryptionService(
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
      service = new EncryptionService(mockConfigService as any, repo as any);

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

    it('should pass through when key_check is null (pre-migration user)', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(dek).toBeDefined();
      expect(dek.length).toBe(32);
    });

    it('should skip key_check validation on cache hit', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const wrongDek = randomBytes(32);

      service = new EncryptionService(
        mockConfigService as any,
        mockRepository as any,
      );
      const invalidKeyCheck = service.generateKeyCheck(wrongDek);

      // First call: no key_check → caches DEK
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null as string | null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);

      // Swap mock to return invalid key_check — should not matter because cache hit
      findSaltByUserId.mockImplementation(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: invalidKeyCheck,
        }),
      );

      const dek2 = await service.ensureUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(dek2).toEqual(dek);
      // Only 1 DB call — second was served from cache
      expect(findSaltByUserId.mock.calls.length).toBe(1);
    });
  });

  describe('getUserDEK', () => {
    it('should throw when user has no salt', async () => {
      const findSaltByUserId = mock(() => Promise.resolve(null));

      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      try {
        await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('No encryption key found');
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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      service = new EncryptionService(
        mockConfigService as any,
        mockRepository as any,
      );
    });

    it('should roundtrip batch encryption and decryption', () => {
      const dek = randomBytes(32);
      const amounts = [100.5, 0, 0.01, 99999.99, -500.25];

      const encrypted = service.encryptAmounts(amounts, dek);
      const decrypted = service.decryptAmounts(encrypted, dek);

      expect(decrypted).toEqual(amounts);
    });

    it('should produce different ciphertexts for batch with same plaintext values', () => {
      const dek = randomBytes(32);
      const amounts = [1234.56, 1234.56];

      const encrypted = service.encryptAmounts(amounts, dek);

      expect(encrypted[0]).not.toBe(encrypted[1]);
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

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      const amount = 1234.56;

      const encrypted = service.encryptAmount(amount, dek);
      const decrypted = service.decryptAmount(encrypted, dek);

      expect(decrypted).toBe(amount);
    });
  });

  describe('generateRecoveryKey', () => {
    beforeEach(() => {
      service = new EncryptionService(
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
      service = new EncryptionService(
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

  describe('verifyAndEnsureKeyCheck', () => {
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
      const initialService = new EncryptionService(
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
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.verifyAndEnsureKeyCheck(
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
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.verifyAndEnsureKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(result).toBe(false);
    });

    it('should generate and store key_check when missing', async () => {
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
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.verifyAndEnsureKeyCheck(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(result).toBe(true);
      expect(updateKeyCheckIfNull).toHaveBeenCalledTimes(1);
      expect(updateKeyCheckIfNull.mock.calls[0][0]).toBe(TEST_USER_ID);
      expect(typeof updateKeyCheckIfNull.mock.calls[0][1]).toBe('string');
    });

    it('should propagate repository errors on findByUserId failure', async () => {
      const findByUserId = mock(() =>
        Promise.reject(new Error('Database connection failed')),
      );

      const repo = createMockRepository({ findByUserId });
      service = new EncryptionService(mockConfigService as any, repo as any);

      await expect(
        service.verifyAndEnsureKeyCheck(TEST_USER_ID, TEST_CLIENT_KEY),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('storeKeyCheck', () => {
    it('should delegate to repository updateKeyCheck', async () => {
      const updateKeyCheck = mock(() => Promise.resolve());
      const repo = createMockRepository({ updateKeyCheck });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const keyCheck = 'test-key-check-value';
      await service.storeKeyCheck(TEST_USER_ID, keyCheck);

      expect(updateKeyCheck).toHaveBeenCalledWith(TEST_USER_ID, keyCheck);
    });

    it('should await repository call', async () => {
      let resolved = false;
      const updateKeyCheck = mock(async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolved = true;
      });
      const repo = createMockRepository({ updateKeyCheck });
      service = new EncryptionService(mockConfigService as any, repo as any);

      await service.storeKeyCheck(TEST_USER_ID, 'test-key-check');

      expect(resolved).toBe(true);
    });
  });

  describe('prepareAmountData', () => {
    it('should return encrypted string as amount', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const results = await service.prepareAmountsData(
        [],
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );

      expect(results).toEqual([]);
    });

    it('should handle single amount', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

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
      service = new EncryptionService(
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
    it('should create recovery key when none exists', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEKIfNull = mock(() => Promise.resolve(true));

      const repo = createMockRepository({
        findSaltByUserId,
        updateWrappedDEKIfNull,
      });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.createRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(updateWrappedDEKIfNull).toHaveBeenCalledTimes(1);
    });

    it('should throw RECOVERY_KEY_ALREADY_EXISTS when wrapped_dek exists', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const updateWrappedDEKIfNull = mock(() => Promise.resolve(false));

      const repo = createMockRepository({
        findSaltByUserId,
        updateWrappedDEKIfNull,
      });
      service = new EncryptionService(mockConfigService as any, repo as any);

      try {
        await service.createRecoveryKey(TEST_USER_ID, TEST_CLIENT_KEY);
        expect.unreachable('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_DEFINITIONS.RECOVERY_KEY_ALREADY_EXISTS.code,
        );
      }
    });
  });

  describe('regenerateRecoveryKey', () => {
    it('should regenerate recovery key even when one already exists', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: 'existing-wrapped-dek',
          key_check: 'existing-key-check',
        }),
      );
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
      });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.regenerateRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(updateWrappedDEK).toHaveBeenCalledTimes(1);
    });

    it('should regenerate recovery key when none exists', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const findByUserId = mock(() => Promise.resolve(null));
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
      });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.regenerateRecoveryKey(
        TEST_USER_ID,
        TEST_CLIENT_KEY,
      );
      expect(result.formatted).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
      expect(updateWrappedDEK).toHaveBeenCalledTimes(1);
    });
  });

  describe('recoverWithKey', () => {
    beforeEach(() => {
      service = new EncryptionService(
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

      service = new EncryptionService(mockConfigService as any, repo as any);

      const newClientKey = randomBytes(32);
      const recoveryKeyFormatted =
        'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM';

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          recoveryKeyFormatted,
          newClientKey,
          mock(() => Promise.resolve()),
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('No recovery key configured');
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

      service = new EncryptionService(mockConfigService as any, repo as any);

      const newClientKey = randomBytes(32);
      // Invalid recovery key (too short after base32 decode)
      const invalidRecoveryKey = 'AAAA-BBBB';

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          invalidRecoveryKey,
          newClientKey,
          mock(() => Promise.resolve()),
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Invalid recovery key');
      }
    });

    it('should invalidate previous recovery key after regeneration', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      let wrappedDek: string | null = null;

      const findSaltByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          key_check: null,
        }),
      );
      const findByUserId = mock(() =>
        Promise.resolve({
          salt: existingSalt,
          kdf_iterations: 600000,
          wrapped_dek: wrappedDek,
          key_check: null,
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

      const repo = createMockRepository({
        findSaltByUserId,
        findByUserId,
        updateWrappedDEK,
        updateWrappedDEKIfNull,
      });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const clientKey = randomBytes(32);
      const first = await service.createRecoveryKey(TEST_USER_ID, clientKey);
      const firstWrapped = wrappedDek;
      expect(firstWrapped).not.toBeNull();

      await service.regenerateRecoveryKey(TEST_USER_ID, clientKey);
      expect(wrappedDek).not.toBe(firstWrapped);

      const reEncryptUserData = mock(() => Promise.resolve());
      const newClientKey = randomBytes(32);

      try {
        await service.recoverWithKey(
          TEST_USER_ID,
          first.formatted,
          newClientKey,
          reEncryptUserData,
        );
        expect.unreachable('Should have thrown');
      } catch {
        expect(reEncryptUserData).not.toHaveBeenCalled();
      }
    });
  });
});
