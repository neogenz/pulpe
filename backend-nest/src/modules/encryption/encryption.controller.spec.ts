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
}) => ({
  getUserSalt:
    overrides?.getUserSalt ??
    mock(() => Promise.resolve({ salt: 'test-salt', kdfIterations: 600000 })),
  onPasswordChange:
    overrides?.onPasswordChange ?? mock(() => Promise.resolve()),
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
});
