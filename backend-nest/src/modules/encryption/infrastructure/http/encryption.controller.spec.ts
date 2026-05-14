import { describe, it, expect, mock } from 'bun:test';
import { EncryptionController } from './encryption.controller';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const createMockUseCases = (overrides?: {
  getVaultStatus?: ReturnType<typeof mock>;
  getUserSalt?: ReturnType<typeof mock>;
  validateUserKey?: ReturnType<typeof mock>;
  setupRecoveryKey?: ReturnType<typeof mock>;
  regenerateRecoveryKey?: ReturnType<typeof mock>;
  verifyRecoveryKey?: ReturnType<typeof mock>;
  recoverWithRecoveryKey?: ReturnType<typeof mock>;
  changePin?: ReturnType<typeof mock>;
}) => ({
  getVaultStatus: {
    execute:
      overrides?.getVaultStatus ??
      mock(() =>
        Promise.resolve({
          pinCodeConfigured: false,
          recoveryKeyConfigured: false,
          vaultCodeConfigured: false,
        }),
      ),
  },
  getUserSalt: {
    execute:
      overrides?.getUserSalt ??
      mock(() =>
        Promise.resolve({
          salt: 'test-salt',
          kdfIterations: 600000,
          hasRecoveryKey: false,
        }),
      ),
  },
  validateUserKey: {
    execute: overrides?.validateUserKey ?? mock(() => Promise.resolve()),
  },
  setupRecoveryKey: {
    execute:
      overrides?.setupRecoveryKey ??
      mock(() => Promise.resolve({ recoveryKey: 'XXXX-YYYY-ZZZZ-1234' })),
  },
  regenerateRecoveryKey: {
    execute:
      overrides?.regenerateRecoveryKey ??
      mock(() => Promise.resolve({ recoveryKey: 'XXXX-YYYY-ZZZZ-5678' })),
  },
  verifyRecoveryKey: {
    execute: overrides?.verifyRecoveryKey ?? mock(() => Promise.resolve()),
  },
  recoverWithRecoveryKey: {
    execute: overrides?.recoverWithRecoveryKey ?? mock(() => Promise.resolve()),
  },
  changePin: {
    execute:
      overrides?.changePin ??
      mock(() =>
        Promise.resolve({
          keyCheck: 'mock-key-check',
          recoveryKey: 'MOCK-RECO-VERY-KEY0',
        }),
      ),
  },
});

const createMockUser = (): AuthenticatedUser => ({
  id: 'user-1',
  email: 'test@test.com',
  accessToken: 'token',
  clientKey: Buffer.alloc(32, 0xab),
});

function setupController(overrides?: Parameters<typeof createMockUseCases>[0]) {
  const useCases = createMockUseCases(overrides);
  const controller = new EncryptionController(
    useCases.getVaultStatus as any,
    useCases.getUserSalt as any,
    useCases.validateUserKey as any,
    useCases.setupRecoveryKey as any,
    useCases.regenerateRecoveryKey as any,
    useCases.verifyRecoveryKey as any,
    useCases.recoverWithRecoveryKey as any,
    useCases.changePin as any,
  );
  return { controller, useCases };
}

describe('EncryptionController', () => {
  describe('getVaultStatus', () => {
    it('should delegate to GetVaultStatusUseCase with user id', async () => {
      const user = createMockUser();
      const expected = {
        pinCodeConfigured: true,
        recoveryKeyConfigured: true,
        vaultCodeConfigured: true,
      };

      const { controller, useCases } = setupController({
        getVaultStatus: mock(() => Promise.resolve(expected)),
      });

      const result = await controller.getVaultStatus(user);

      expect(result).toEqual(expected);
      expect(useCases.getVaultStatus.execute.mock.calls.length).toBe(1);
      expect(useCases.getVaultStatus.execute.mock.calls[0][0]).toBe(user.id);
    });
  });

  describe('getSalt', () => {
    it('should delegate to GetUserSaltUseCase with user id', async () => {
      const user = createMockUser();
      const expected = {
        salt: 'generated-salt-abc123',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      };

      const { controller, useCases } = setupController({
        getUserSalt: mock(() => Promise.resolve(expected)),
      });

      const result = await controller.getSalt(user);

      expect(result).toEqual(expected);
      expect(useCases.getUserSalt.execute.mock.calls.length).toBe(1);
      expect(useCases.getUserSalt.execute.mock.calls[0][0]).toBe(user.id);
    });
  });

  describe('validateKey', () => {
    it('should return void (204) when key is valid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      const { controller, useCases } = setupController();

      const result = await controller.validateKey(user, body);

      expect(result).toBeUndefined();
      expect(useCases.validateUserKey.execute.mock.calls.length).toBe(1);
    });

    it('should propagate BusinessException from use case when key invalid', async () => {
      const user = createMockUser();
      const body = { clientKey: 'ab'.repeat(32) };

      const { controller } = setupController({
        validateUserKey: mock(() =>
          Promise.reject(
            new BusinessException(
              ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
            ),
          ),
        ),
      });

      try {
        await controller.validateKey(user, body);
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
        );
      }
    });

    it('should call use case with userId and parsed key buffer', async () => {
      const user = createMockUser();
      const clientKeyHex = 'ab'.repeat(32);
      const body = { clientKey: clientKeyHex };

      const callArgs: any[] = [];
      const validateUserKey = mock((...args: unknown[]) => {
        callArgs.push(args);
        return Promise.resolve();
      });

      const { controller } = setupController({ validateUserKey });

      await controller.validateKey(user, body);

      expect(callArgs.length).toBe(1);
      expect(callArgs[0][0]).toBe(user.id);
      const buffer = callArgs[0][1] as Buffer;
      expect(Buffer.isBuffer(buffer)).toBe(true);
      // After the controller's finally block the buffer must be zero-filled
      expect(buffer.every((b) => b === 0)).toBe(true);
    });

    it('should throw BusinessException for invalid hex format', async () => {
      const user = createMockUser();
      const body = { clientKey: 'invalid-hex' };

      const { controller } = setupController();

      try {
        await controller.validateKey(user, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
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
    it('should delegate to SetupRecoveryKeyUseCase with userId and clientKey', async () => {
      const user = createMockUser();
      const expected = { recoveryKey: 'AAAA-BBBB-CCCC-1234' };

      const { controller, useCases } = setupController({
        setupRecoveryKey: mock(() => Promise.resolve(expected)),
      });

      const result = await controller.setupRecovery(user);

      expect(result).toEqual(expected);
      expect(useCases.setupRecoveryKey.execute.mock.calls.length).toBe(1);
      expect(useCases.setupRecoveryKey.execute.mock.calls[0][0]).toBe(user.id);
      expect(useCases.setupRecoveryKey.execute.mock.calls[0][1]).toBe(
        user.clientKey,
      );
    });
  });

  describe('regenerateRecovery', () => {
    it('should delegate to RegenerateRecoveryKeyUseCase with userId and clientKey', async () => {
      const user = createMockUser();
      const expected = { recoveryKey: 'AAAA-BBBB-CCCC-9999' };

      const { controller, useCases } = setupController({
        regenerateRecoveryKey: mock(() => Promise.resolve(expected)),
      });

      const result = await controller.regenerateRecovery(user);

      expect(result).toEqual(expected);
      expect(useCases.regenerateRecoveryKey.execute.mock.calls.length).toBe(1);
      expect(useCases.regenerateRecoveryKey.execute.mock.calls[0][0]).toBe(
        user.id,
      );
      expect(useCases.regenerateRecoveryKey.execute.mock.calls[0][1]).toBe(
        user.clientKey,
      );
    });
  });

  describe('recover', () => {
    it('should return success true on successful recovery', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
        newClientKey: 'cd'.repeat(32),
      };

      const { controller } = setupController();

      const result = await controller.recover(user, supabase, body);

      expect(result).toEqual({ success: true });
    });

    it('should throw BusinessException for missing recoveryKey', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = { recoveryKey: '   ', newClientKey: 'cd'.repeat(32) };

      const { controller } = setupController();

      try {
        await controller.recover(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for invalid hex newClientKey', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
        newClientKey: 'short',
      };

      const { controller } = setupController();

      try {
        await controller.recover(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for all-zero newClientKey', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
        newClientKey: '00'.repeat(32),
      };

      const { controller } = setupController();

      try {
        await controller.recover(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should propagate use case errors (recovery key mapping handled by use case)', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
        newClientKey: 'cd'.repeat(32),
      };

      const { controller } = setupController({
        recoverWithRecoveryKey: mock(() =>
          Promise.reject(
            new BusinessException(
              ERROR_DEFINITIONS.RECOVERY_KEY_INVALID,
              undefined,
              { userId: user.id, operation: 'recovery.failed' },
            ),
          ),
        ),
      });

      try {
        await controller.recover(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
      }
    });

    it('should call recover use case with supabase client', async () => {
      const user = createMockUser();
      const supabase = { mock: 'supabase-client' } as any;
      const body = {
        recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
        newClientKey: 'cd'.repeat(32),
      };

      const { controller, useCases } = setupController();

      await controller.recover(user, supabase, body);

      expect(useCases.recoverWithRecoveryKey.execute.mock.calls.length).toBe(1);
      const args = useCases.recoverWithRecoveryKey.execute.mock.calls[0];
      expect(args[0]).toBe(user.id);
      expect(args[1]).toBe(body.recoveryKey);
      expect(Buffer.isBuffer(args[2])).toBe(true);
      expect(args[3]).toBe(supabase);
    });
  });

  describe('verifyRecoveryKey', () => {
    it('should delegate to VerifyRecoveryKeyUseCase', async () => {
      const user = createMockUser();
      const body = { recoveryKey: 'AAAA-BBBB-CCCC-DDDD' };

      const { controller, useCases } = setupController();

      await controller.verifyRecoveryKey(user, body);

      expect(useCases.verifyRecoveryKey.execute.mock.calls.length).toBe(1);
      expect(useCases.verifyRecoveryKey.execute.mock.calls[0][0]).toBe(user.id);
      expect(useCases.verifyRecoveryKey.execute.mock.calls[0][1]).toBe(
        body.recoveryKey,
      );
    });
  });

  describe('changePin', () => {
    it('should return result from ChangePinUseCase', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: 'aa'.repeat(32),
        newClientKey: 'bb'.repeat(32),
      };
      const expected = {
        keyCheck: 'mock-check',
        recoveryKey: 'AAAA-BBBB-CCCC-1234',
      };

      const { controller } = setupController({
        changePin: mock(() => Promise.resolve(expected)),
      });

      const result = await controller.changePin(user, supabase, body);

      expect(result).toEqual(expected);
    });

    it('should throw BusinessException for invalid oldClientKey format', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: 'invalid',
        newClientKey: 'bb'.repeat(32),
      };

      const { controller } = setupController();

      try {
        await controller.changePin(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for invalid newClientKey format', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: 'aa'.repeat(32),
        newClientKey: 'invalid',
      };

      const { controller } = setupController();

      try {
        await controller.changePin(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for all-zero oldClientKey', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: '00'.repeat(32),
        newClientKey: 'bb'.repeat(32),
      };

      const { controller } = setupController();

      try {
        await controller.changePin(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should throw BusinessException for all-zero newClientKey', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: 'aa'.repeat(32),
        newClientKey: '00'.repeat(32),
      };

      const { controller } = setupController();

      try {
        await controller.changePin(user, supabase, body);
        expect.unreachable('Should have thrown BusinessException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.code).toBe(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID.code);
      }
    });

    it('should zero both buffers after the call (success path)', async () => {
      const user = createMockUser();
      const supabase = {} as any;
      const body = {
        oldClientKey: 'aa'.repeat(32),
        newClientKey: 'bb'.repeat(32),
      };

      const callArgs: any[] = [];
      const changePin = mock((...args: unknown[]) => {
        callArgs.push(args);
        return Promise.resolve({
          keyCheck: 'mock',
          recoveryKey: 'XXXX-YYYY-ZZZZ-1234',
        });
      });

      const { controller } = setupController({ changePin });

      await controller.changePin(user, supabase, body);

      const oldBuffer = callArgs[0][1] as Buffer;
      const newBuffer = callArgs[0][2] as Buffer;
      expect(oldBuffer.every((b) => b === 0)).toBe(true);
      expect(newBuffer.every((b) => b === 0)).toBe(true);
    });
  });
});
