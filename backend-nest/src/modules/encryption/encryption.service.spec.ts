import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { randomBytes } from 'node:crypto';
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
  updateSalt?: ReturnType<typeof mock>;
  updateWrappedDEK?: ReturnType<typeof mock>;
}) => ({
  findSaltByUserId:
    overrides?.findSaltByUserId ?? mock(() => Promise.resolve(null)),
  findByUserId: overrides?.findByUserId ?? mock(() => Promise.resolve(null)),
  upsertSalt: overrides?.upsertSalt ?? mock(() => Promise.resolve()),
  updateSalt: overrides?.updateSalt ?? mock(() => Promise.resolve()),
  updateWrappedDEK:
    overrides?.updateWrappedDEK ?? mock(() => Promise.resolve()),
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const dek = await service.getUserDEK(TEST_USER_ID, TEST_CLIENT_KEY);
      expect(dek).toBeDefined();
      expect(dek.length).toBe(32);
    });
  });

  describe('getUserSalt', () => {
    it('should return existing salt and iterations', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
      );

      const repo = createMockRepository({ findSaltByUserId });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.getUserSalt(TEST_USER_ID);
      expect(result.salt).toBe(existingSalt);
      expect(result.kdfIterations).toBe(600000);
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
        });
      });
      const upsertSalt = mock(() => Promise.resolve());

      const repo = createMockRepository({ findSaltByUserId, upsertSalt });

      service = new EncryptionService(mockConfigService as any, repo as any);

      const result = await service.getUserSalt(TEST_USER_ID);
      expect(result.salt).toBeDefined();
      expect(result.salt.length).toBe(32); // 16 bytes hex = 32 chars
      expect(result.kdfIterations).toBe(600000);
      expect(upsertSalt).toHaveBeenCalled();
    });
  });

  describe('onPasswordChange', () => {
    it('should serialize concurrent password changes for same user', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
      );
      const updateSalt = mock(() => Promise.resolve());

      const repo = createMockRepository({ findSaltByUserId, updateSalt });
      service = new EncryptionService(mockConfigService as any, repo as any);

      const executionOrder: number[] = [];

      const change1 = service.onPasswordChange(
        TEST_USER_ID,
        randomBytes(32),
        randomBytes(32),
        async () => {
          executionOrder.push(1);
          await new Promise((r) => setTimeout(r, 50));
          executionOrder.push(2);
        },
      );

      const change2 = service.onPasswordChange(
        TEST_USER_ID,
        randomBytes(32),
        randomBytes(32),
        async () => {
          executionOrder.push(3);
        },
      );

      await Promise.all([change1, change2]);

      // change1 must complete (1,2) before change2 starts (3)
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should rollback salt on re-encryption failure', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
      );
      const updateSalt = mock(() => Promise.resolve());

      const repo = createMockRepository({ findSaltByUserId, updateSalt });
      service = new EncryptionService(mockConfigService as any, repo as any);

      try {
        await service.onPasswordChange(
          TEST_USER_ID,
          randomBytes(32),
          randomBytes(32),
          async () => {
            throw new Error('Re-encryption failed');
          },
        );
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Re-encryption failed');
      }

      // updateSalt called twice: once for new salt, once for rollback
      expect(updateSalt.mock.calls.length).toBe(2);
      // Second call should restore the original salt
      const rollbackCall = updateSalt.mock.calls[1] as unknown[];
      expect(rollbackCall[1]).toBe(existingSalt);
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
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
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

  describe('onPasswordChange wrapped_dek invalidation', () => {
    it('should null out wrapped_dek after password change', async () => {
      const existingSalt = randomBytes(16).toString('hex');
      const findSaltByUserId = mock(() =>
        Promise.resolve({ salt: existingSalt, kdf_iterations: 600000 }),
      );
      const updateSalt = mock(() => Promise.resolve());
      const updateWrappedDEK = mock(() => Promise.resolve());

      const repo = createMockRepository({
        findSaltByUserId,
        updateSalt,
        updateWrappedDEK,
      });
      service = new EncryptionService(mockConfigService as any, repo as any);

      await service.onPasswordChange(
        TEST_USER_ID,
        randomBytes(32),
        randomBytes(32),
        async () => {},
      );

      expect(updateWrappedDEK).toHaveBeenCalledWith(TEST_USER_ID, null);
    });
  });
});
