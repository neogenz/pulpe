import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EncryptionController } from './encryption.controller';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const createMockEncryptionService = (overrides?: {
  getUserSalt?: ReturnType<typeof mock>;
  onPasswordChange?: ReturnType<typeof mock>;
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
  onPasswordChange:
    overrides?.onPasswordChange ?? mock(() => Promise.resolve()),
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
}) => ({
  reEncryptAllUserData:
    overrides?.reEncryptAllUserData ?? mock(() => Promise.resolve()),
});

const createMockUser = (): AuthenticatedUser => ({
  id: 'user-1',
  email: 'test@test.com',
  accessToken: 'token',
  clientKey: Buffer.alloc(32, 0xab),
});

describe('EncryptionController', () => {
  let controller: EncryptionController;
  let mockEncryptionService: ReturnType<typeof createMockEncryptionService>;
  let mockRekeyService: ReturnType<typeof createMockRekeyService>;

  beforeEach(() => {
    mockEncryptionService = createMockEncryptionService();
    mockRekeyService = createMockRekeyService();
    controller = new EncryptionController(
      mockEncryptionService as any,
      mockRekeyService as any,
    );
  });

  describe('getSalt', () => {
    it('should return salt and kdfIterations from encryption service', async () => {
      const user = createMockUser();
      const expectedResult = {
        salt: 'generated-salt-abc123',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      };

      mockEncryptionService = createMockEncryptionService({
        getUserSalt: mock(() => Promise.resolve(expectedResult)),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      const result = await controller.getSalt(user);

      expect(result).toEqual(expectedResult);
      expect(mockEncryptionService.getUserSalt.mock.calls.length).toBe(1);
      expect(mockEncryptionService.getUserSalt.mock.calls[0][0]).toBe(user.id);
    });
  });

  describe('onPasswordChange', () => {
    it('should call onPasswordChange with correct parameters', async () => {
      const user = createMockUser();
      const body = { newClientKey: 'ab'.repeat(32) };
      const mockSupabase = {};

      let callbackCalled = false;
      mockEncryptionService = createMockEncryptionService({
        onPasswordChange: mock(async (userId, oldKey, newKey, callback) => {
          callbackCalled = true;
          await callback(randomBytes(32), randomBytes(32));
        }),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      const result = await controller.onPasswordChange(
        user,
        mockSupabase as any,
        body,
      );

      expect(result).toEqual({ success: true });
      expect(mockEncryptionService.onPasswordChange.mock.calls.length).toBe(1);
      expect(callbackCalled).toBe(true);
    });

    it('should pass oldClientKey and newClientKey to encryptionService', async () => {
      const user = createMockUser();
      const newKeyHex = 'ab'.repeat(32);
      const body = { newClientKey: newKeyHex };
      const mockSupabase = {};

      const callArguments: any[] = [];
      mockEncryptionService = createMockEncryptionService({
        onPasswordChange: mock(async (...args) => {
          callArguments.push(...args);
        }),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.onPasswordChange(user, mockSupabase as any, body);

      expect(callArguments[0]).toBe(user.id);
      expect(callArguments[1]).toEqual(user.clientKey);
      expect(callArguments[2]).toEqual(Buffer.from(newKeyHex, 'hex'));
    });

    it('should call rekeyService.reEncryptAllUserData via callback', async () => {
      const user = createMockUser();
      const body = { newClientKey: 'ab'.repeat(32) };
      const mockSupabase = { test: 'supabase' };

      mockEncryptionService = createMockEncryptionService({
        onPasswordChange: mock(async (_userId, _oldKey, _newKey, callback) => {
          await callback(randomBytes(32), randomBytes(32));
        }),
      });
      mockRekeyService = createMockRekeyService();

      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.onPasswordChange(user, mockSupabase as any, body);

      expect(mockRekeyService.reEncryptAllUserData.mock.calls.length).toBe(1);
      const callArgs = mockRekeyService.reEncryptAllUserData.mock.calls[0];
      expect(callArgs[0]).toBe(user.id);
      expect(callArgs[3]).toEqual(mockSupabase);
    });

    it('should throw BusinessException for invalid key length', async () => {
      const user = createMockUser();
      const body = { newClientKey: 'ab'.repeat(16) };

      try {
        await controller.onPasswordChange(user, {} as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for key too long', async () => {
      const user = createMockUser();
      const body = { newClientKey: 'ab'.repeat(48) };

      try {
        await controller.onPasswordChange(user, {} as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for empty key', async () => {
      const user = createMockUser();
      const body = { newClientKey: '' };

      try {
        await controller.onPasswordChange(user, {} as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should log audit event after successful password change', async () => {
      const user = createMockUser();
      const body = { newClientKey: 'ab'.repeat(32) };
      const mockSupabase = {};
      const logSpy = spyOn(Logger.prototype, 'log');

      mockEncryptionService = createMockEncryptionService({
        onPasswordChange: mock(async (_userId, _oldKey, _newKey, callback) => {
          await callback(randomBytes(32), randomBytes(32));
        }),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.onPasswordChange(user, mockSupabase as any, body);

      expect(logSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'password_change.complete' },
        'User password change completed with data re-encryption',
      );

      logSpy.mockRestore();
    });
  });

  describe('validateKey', () => {
    it('should return void (204) when key is valid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      mockEncryptionService = createMockEncryptionService({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(true)),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      const result = await controller.validateKey(user, body);

      expect(result).toBeUndefined();
      expect(
        mockEncryptionService.verifyAndEnsureKeyCheck.mock.calls.length,
      ).toBe(1);
    });

    it('should throw BusinessException when key is invalid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      mockEncryptionService = createMockEncryptionService({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(false)),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

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
      mockEncryptionService = createMockEncryptionService({
        verifyAndEnsureKeyCheck: mock(async (...args) => {
          callArguments.push(...args);
          return true;
        }),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.validateKey(user, body);

      expect(callArguments[0]).toBe(user.id);
      expect(callArguments[1]).toEqual(Buffer.from(clientKeyHex, 'hex'));
    });

    it('should throw BusinessException for invalid hex format', async () => {
      const user = createMockUser();
      const body = { clientKey: 'not-valid-hex' };

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

      mockEncryptionService = createMockEncryptionService({
        verifyAndEnsureKeyCheck: mock(() => Promise.resolve(false)),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

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
  });

  describe('setupRecovery', () => {
    it('should return recoveryKey from encryptionService', async () => {
      const user = createMockUser();
      const expectedRecoveryKey = 'XXXX-YYYY-ZZZZ-1234';

      mockEncryptionService = createMockEncryptionService({
        setupRecoveryKey: mock(() =>
          Promise.resolve({ formatted: expectedRecoveryKey }),
        ),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

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

      mockEncryptionService = createMockEncryptionService({
        getUserDEK,
        generateKeyCheck,
        storeKeyCheck,
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

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

      mockEncryptionService = createMockEncryptionService({
        setupRecoveryKey: mock(async (...args) => {
          callArguments.push(...args);
          return { formatted: 'XXXX-YYYY-ZZZZ-1234' };
        }),
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.setupRecovery(user);

      expect(callArguments[0]).toBe(user.id);
      expect(callArguments[1]).toEqual(user.clientKey);
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

      const result = await controller.recover(user, mockSupabase as any, body);

      expect(result).toEqual({ success: true });
    });

    it('should throw BusinessException for missing recoveryKey', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = { recoveryKey: '', newClientKey: 'ab'.repeat(32) };

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

      try {
        await controller.recover(user, mockSupabase as any, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
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
      mockEncryptionService = createMockEncryptionService({
        recoverWithKey: mock(
          async (_userId, _recoveryKey, _newKey, callback) => {
            callbackCalled = true;
            await callback(randomBytes(32), randomBytes(32));
          },
        ),
      });
      mockRekeyService = createMockRekeyService();
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.recover(user, mockSupabase as any, body);

      expect(callbackCalled).toBe(true);
      expect(mockRekeyService.reEncryptAllUserData.mock.calls.length).toBe(1);
    });

    it('should regenerate key_check after recovery', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };

      const mockDek = randomBytes(32);
      const mockKeyCheck = 'recovery-key-check';
      const getUserDEK = mock(() => Promise.resolve(mockDek));
      const generateKeyCheck = mock(() => mockKeyCheck);
      const storeKeyCheck = mock(() => Promise.resolve());

      mockEncryptionService = createMockEncryptionService({
        getUserDEK,
        generateKeyCheck,
        storeKeyCheck,
      });
      controller = new EncryptionController(
        mockEncryptionService as any,
        mockRekeyService as any,
      );

      await controller.recover(user, mockSupabase as any, body);

      const getUserDEKCalls = getUserDEK.mock.calls as unknown[][];
      expect(getUserDEKCalls.length).toBe(1);
      expect(getUserDEKCalls[0][0]).toBe(user.id);
      expect(getUserDEKCalls[0][1]).toEqual(
        Buffer.from(body.newClientKey, 'hex'),
      );

      const generateKeyCheckCalls = generateKeyCheck.mock.calls as unknown[][];
      const storeKeyCheckCalls = storeKeyCheck.mock.calls as unknown[][];
      expect(generateKeyCheckCalls.length).toBe(1);
      expect(storeKeyCheckCalls.length).toBe(1);
      expect(storeKeyCheckCalls[0][0]).toBe(user.id);
      expect(storeKeyCheckCalls[0][1]).toBe(mockKeyCheck);
    });

    it('should log audit event with recovery.complete operation', async () => {
      const user = createMockUser();
      const mockSupabase = {};
      const body = {
        recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        newClientKey: 'ab'.repeat(32),
      };
      const logSpy = spyOn(Logger.prototype, 'log');

      await controller.recover(user, mockSupabase as any, body);

      expect(logSpy).toHaveBeenCalledWith(
        { userId: user.id, operation: 'recovery.complete' },
        'Account recovered with recovery key',
      );

      logSpy.mockRestore();
    });
  });
});
