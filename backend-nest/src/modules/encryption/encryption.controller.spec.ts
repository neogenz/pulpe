import { describe, it, expect, mock, spyOn } from 'bun:test';
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EncryptionController } from './encryption.controller';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const createMockEncryptionService = (overrides?: {
  getUserSalt?: ReturnType<typeof mock>;
  getUserDEK?: ReturnType<typeof mock>;
  generateKeyCheck?: ReturnType<typeof mock>;
  storeKeyCheck?: ReturnType<typeof mock>;
  verifyAndEnsureKeyCheck?: ReturnType<typeof mock>;
  setupRecoveryKey?: ReturnType<typeof mock>;
  recoverWithKey?: ReturnType<typeof mock>;
}) => ({
  getUserSalt:
    overrides?.getUserSalt ??
    mock(() => Promise.resolve({ salt: 'test-salt', kdfIterations: 600000 })),
  getUserDEK:
    overrides?.getUserDEK ?? mock(() => Promise.resolve(randomBytes(32))),
  generateKeyCheck: overrides?.generateKeyCheck ?? mock(() => 'mock-key-check'),
  storeKeyCheck: overrides?.storeKeyCheck ?? mock(() => Promise.resolve()),
  verifyAndEnsureKeyCheck:
    overrides?.verifyAndEnsureKeyCheck ?? mock(() => Promise.resolve(true)),
  setupRecoveryKey:
    overrides?.setupRecoveryKey ??
    mock(() => Promise.resolve({ formatted: 'XXXX-YYYY-ZZZZ-1234' })),
  recoverWithKey: overrides?.recoverWithKey ?? mock(() => Promise.resolve()),
});

const createMockRekeyService = (overrides?: {
  reEncryptAllUserData?: ReturnType<typeof mock>;
  rekeyUserData?: ReturnType<typeof mock>;
}) => ({
  reEncryptAllUserData:
    overrides?.reEncryptAllUserData ?? mock(() => Promise.resolve()),
  rekeyUserData: overrides?.rekeyUserData ?? mock(() => Promise.resolve()),
});

const createMockUser = (): AuthenticatedUser => ({
  id: 'user-1',
  email: 'test@test.com',
  accessToken: 'token',
  clientKey: Buffer.alloc(32, 0xab),
});

function setupController(
  encryptionOverrides?: Parameters<typeof createMockEncryptionService>[0],
  rekeyOverrides?: Parameters<typeof createMockRekeyService>[0],
) {
  const mockEncryptionService =
    createMockEncryptionService(encryptionOverrides);
  const mockRekeyService = createMockRekeyService(rekeyOverrides);
  const controller = new EncryptionController(
    mockEncryptionService as any,
    mockRekeyService as any,
  );
  return { controller, mockEncryptionService, mockRekeyService };
}

describe('EncryptionController', () => {
  describe('getSalt', () => {
    it('should return salt and kdfIterations from encryption service', async () => {
      const user = createMockUser();
      const expectedResult = {
        salt: 'generated-salt-abc123',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      };

      const { controller, mockEncryptionService } = setupController({
        getUserSalt: mock(() => Promise.resolve(expectedResult)),
      });

      const result = await controller.getSalt(user);

      expect(result).toEqual(expectedResult);
      expect(mockEncryptionService.getUserSalt.mock.calls.length).toBe(1);
      expect(mockEncryptionService.getUserSalt.mock.calls[0][0]).toBe(user.id);
    });
  });

  describe('validateKey', () => {
    it('should return void (204) when key is valid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      const { controller, mockEncryptionService } = setupController({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(true)),
      });

      const result = await controller.validateKey(user, body);

      expect(result).toBeUndefined();
      expect(
        mockEncryptionService.verifyAndEnsureKeyCheck.mock.calls.length,
      ).toBe(1);
    });

    it('should throw BusinessException when key is invalid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      const { controller } = setupController({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(false)),
      });

      try {
        await controller.validateKey(user, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should call verifyAndEnsureKeyCheck with userId and keyBuffer', async () => {
      const user = createMockUser();
      const clientKeyHex = 'ab'.repeat(32);
      const body = { clientKey: clientKeyHex };

      const callArguments: any[] = [];
      const { controller } = setupController({
        verifyAndEnsureKeyCheck: mock(async (...args) => {
          callArguments.push(...args);
          return true;
        }),
      });

      await controller.validateKey(user, body);

      expect(callArguments[0]).toBe(user.id);
      expect(callArguments[1]).toEqual(Buffer.from(clientKeyHex, 'hex'));
    });

    it('should throw BusinessException for invalid hex format', async () => {
      const user = createMockUser();
      const body = { clientKey: 'not-valid-hex' };

      const { controller } = setupController();

      try {
        await controller.validateKey(user, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should log warning on failed validation', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };
      const warnSpy = spyOn(Logger.prototype, 'warn');

      const { controller } = setupController({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(false)),
      });

      try {
        await controller.validateKey(user, body);
      } catch {
        // Expected to throw
      }

      expect(warnSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'validate_key.failed' },
        'Client key verification failed',
      );

      warnSpy.mockRestore();
    });

    it('should throw BusinessException for all-zero client key', async () => {
      const user = createMockUser();
      const body = { clientKey: '00'.repeat(32) };

      const { controller } = setupController();

      try {
        await controller.validateKey(user, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });
  });

  describe('setupRecovery', () => {
    it('should return recoveryKey from encryptionService', async () => {
      const user = createMockUser();
      const expectedRecoveryKey = 'XXXX-YYYY-ZZZZ-1234';

      const { controller } = setupController({
        setupRecoveryKey: mock(() =>
          Promise.resolve({ formatted: expectedRecoveryKey }),
        ),
      });

      const result = await controller.setupRecovery(user);

      expect(result).toEqual({ recoveryKey: expectedRecoveryKey });
    });

    it('should call getUserDEK, generateKeyCheck, and storeKeyCheck', async () => {
      const user = createMockUser();
      const mockDek = randomBytes(32);
      const mockKeyCheck = 'generated-key-check';

      const getUserDEK = mock(() => Promise.resolve(mockDek));
      const generateKeyCheck = mock(() => mockKeyCheck);
      const storeKeyCheck = mock(() => Promise.resolve());

      const { controller } = setupController({
        getUserDEK,
        generateKeyCheck,
        storeKeyCheck,
      });

      await controller.setupRecovery(user);

      const getUserDEKCalls = getUserDEK.mock.calls as unknown[][];
      expect(getUserDEKCalls.length).toBe(1);
      expect(getUserDEKCalls[0][0]).toBe(user.id);
      expect(getUserDEKCalls[0][1]).toEqual(user.clientKey);

      const generateKeyCheckCalls = generateKeyCheck.mock.calls as unknown[][];
      expect(generateKeyCheckCalls.length).toBe(1);
      expect(generateKeyCheckCalls[0][0]).toEqual(mockDek);

      const storeKeyCheckCalls = storeKeyCheck.mock.calls as unknown[][];
      expect(storeKeyCheckCalls.length).toBe(1);
      expect(storeKeyCheckCalls[0][0]).toBe(user.id);
      expect(storeKeyCheckCalls[0][1]).toBe(mockKeyCheck);
    });

    it('should log audit event with recovery_key.setup operation', async () => {
      const user = createMockUser();
      const logSpy = spyOn(Logger.prototype, 'log');

      const { controller } = setupController();

      await controller.setupRecovery(user);

      expect(logSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'recovery_key.setup' },
        'Recovery key generated and DEK wrapped',
      );

      logSpy.mockRestore();
    });

    it('should use user.clientKey from AuthenticatedUser', async () => {
      const user = createMockUser();
      const callArguments: any[] = [];

      const { controller } = setupController({
        setupRecoveryKey: mock(async (...args) => {
          callArguments.push(...args);
          return { formatted: 'XXXX-YYYY-ZZZZ-1234' };
        }),
      });

      await controller.setupRecovery(user);

      expect(callArguments[0]).toBe(user.id);
      expect(callArguments[1]).toEqual(user.clientKey);
    });
  });

  describe('rekey', () => {
    it('should return success true and call rekeyService with correct args', async () => {
      const user = createMockUser();
      const mockSupabase = { test: 'supabase' };
      const body = { newClientKey: 'ab'.repeat(32) };

      const { controller, mockRekeyService } = setupController();

      const result = await controller.rekey(user, mockSupabase as any, body);

      expect(result).toEqual({ success: true });
      expect(mockRekeyService.rekeyUserData.mock.calls.length).toBe(1);
      const rekeyArgs = mockRekeyService.rekeyUserData.mock
        .calls[0] as unknown[];
      expect(rekeyArgs[0]).toBe(user.id);
      expect(rekeyArgs[1]).toEqual(user.clientKey);
      expect(rekeyArgs[2]).toEqual(Buffer.from(body.newClientKey, 'hex'));
      expect(rekeyArgs[3]).toBe(mockSupabase);
    });

    it('should throw BusinessException for invalid hex newClientKey', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = { newClientKey: 'not-valid-hex' };

      const { controller } = setupController();

      try {
        await controller.rekey(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should delegate key_check to rekey service (atomic RPC)', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = { newClientKey: 'ab'.repeat(32) };

      const getUserDEK = mock(() => Promise.resolve(randomBytes(32)));
      const generateKeyCheck = mock(() => 'should-not-be-called');
      const storeKeyCheck = mock(() => Promise.resolve());

      const { controller, mockRekeyService } = setupController({
        getUserDEK,
        generateKeyCheck,
        storeKeyCheck,
      });

      await controller.rekey(user, mockSupabase as any, body);

      expect(mockRekeyService.rekeyUserData.mock.calls.length).toBe(1);
      expect(getUserDEK).not.toHaveBeenCalled();
      expect(generateKeyCheck).not.toHaveBeenCalled();
      expect(storeKeyCheck).not.toHaveBeenCalled();
    });

    it('should log audit event with rekey.complete operation', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = { newClientKey: 'ab'.repeat(32) };
      const logSpy = spyOn(Logger.prototype, 'log');

      const { controller } = setupController();

      await controller.rekey(user, mockSupabase as any, body);

      expect(logSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'rekey.complete' },
        'User data re-encrypted with new key',
      );

      logSpy.mockRestore();
    });
  });

  describe('recover', () => {
    it('should return success true on successful recovery', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };

      const { controller } = setupController();

      const result = await controller.recover(user, mockSupabase as any, body);

      expect(result).toEqual({ success: true });
    });

    it('should throw BusinessException for missing recoveryKey', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = { recoveryKey: '', newClientKey: 'ab'.repeat(32) };

      const { controller } = setupController();

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for invalid hex newClientKey', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'not-valid-hex',
      };

      const { controller } = setupController();

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should map invalid base32 recovery key errors to BusinessException', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'INVALID-KEY',
        newClientKey: 'ab'.repeat(32),
      };

      const { controller } = setupController({
        recoverWithKey: mock(() =>
          Promise.reject(new Error('Invalid base32 character: 1')),
        ),
      });

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });

    it('should map AES-GCM auth failures to BusinessException', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'ABCD-EFGH-IJKL-MNOP',
        newClientKey: 'ab'.repeat(32),
      };

      const { controller } = setupController({
        recoverWithKey: mock(() =>
          Promise.reject(
            new Error('Unsupported state or unable to authenticate data'),
          ),
        ),
      });

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });

    it('should call recoverWithKey with correct callback', async () => {
      const user = createMockUser();
      const mockSupabase = { test: 'supabase' };
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };

      let callbackCalled = false;
      const { controller, mockRekeyService } = setupController(
        {
          recoverWithKey: mock(
            async (_userId, _recoveryKey, _newKey, callback) => {
              callbackCalled = true;
              await callback(randomBytes(32), randomBytes(32));
            },
          ),
        },
        {},
      );

      await controller.recover(user, mockSupabase as any, body);

      expect(callbackCalled).toBe(true);
      expect(mockRekeyService.reEncryptAllUserData.mock.calls.length).toBe(1);
    });

    it('should delegate key_check to rekey service (atomic RPC)', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };

      const getUserDEK = mock(() => Promise.resolve(randomBytes(32)));
      const generateKeyCheck = mock(() => 'should-not-be-called');
      const storeKeyCheck = mock(() => Promise.resolve());

      const { controller, mockRekeyService } = setupController({
        getUserDEK,
        generateKeyCheck,
        storeKeyCheck,
      });

      await controller.recover(user, mockSupabase as any, body);

      expect(mockRekeyService.reEncryptAllUserData.mock.calls.length).toBe(0);
      expect(getUserDEK).not.toHaveBeenCalled();
      expect(generateKeyCheck).not.toHaveBeenCalled();
      expect(storeKeyCheck).not.toHaveBeenCalled();
    });

    it('should log audit event with recovery.complete operation', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };
      const logSpy = spyOn(Logger.prototype, 'log');

      const { controller } = setupController();

      await controller.recover(user, mockSupabase as any, body);

      expect(logSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'recovery.complete' },
        'Account recovered with recovery key',
      );

      logSpy.mockRestore();
    });

    it('should throw BusinessException for all-zero newClientKey', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: '00'.repeat(32),
      };

      const { controller } = setupController();

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should re-throw non-recovery errors without wrapping', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };

      const originalError = new Error('DB connection lost');
      const { controller } = setupController({
        recoverWithKey: mock(() => Promise.reject(originalError)),
      });

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown original error');
      } catch (error: any) {
        expect(error).not.toBeInstanceOf(BusinessException);
        expect(error).toBe(originalError);
        expect(error.message).toBe('DB connection lost');
      }
    });
  });
});
