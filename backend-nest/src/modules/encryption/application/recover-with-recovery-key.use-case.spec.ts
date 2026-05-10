import { describe, it, expect, mock } from 'bun:test';
import { RecoverWithRecoveryKeyUseCase } from './recover-with-recovery-key.use-case';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const createMockLogger = () => ({
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
});

describe('RecoverWithRecoveryKeyUseCase', () => {
  it('logs recovery.complete on successful recovery', async () => {
    const cryptoService = {
      recoverWithKey: mock(() => Promise.resolve()),
    };
    const logger = createMockLogger();
    const useCase = new RecoverWithRecoveryKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    await useCase.execute(
      'user-1',
      'AAAA-BBBB-CCCC-DDDD',
      Buffer.alloc(32, 0xab),
      {} as any,
    );

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { userId: 'user-1', operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );
  });

  it('rethrows BusinessException from cryptoService unchanged', async () => {
    const original = new BusinessException(
      ERROR_DEFINITIONS.RECOVERY_KEY_INVALID,
      undefined,
      { userId: 'user-1', operation: 'recover.unwrap_failed' },
    );
    const cryptoService = {
      recoverWithKey: mock(() => Promise.reject(original)),
    };
    const useCase = new RecoverWithRecoveryKeyUseCase(
      cryptoService as any,
      createMockLogger() as any,
    );

    try {
      await useCase.execute(
        'user-1',
        'WRONG-KEY',
        Buffer.alloc(32, 0xab),
        {} as any,
      );
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error).toBe(original);
      expect(error.code).toBe(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID.code);
    }
  });

  it('rethrows RECOVERY_KEY_NOT_CONFIGURED unchanged', async () => {
    const original = new BusinessException(
      ERROR_DEFINITIONS.RECOVERY_KEY_NOT_CONFIGURED,
      undefined,
      { userId: 'user-1', operation: 'recover.no_wrapped_dek' },
    );
    const cryptoService = {
      recoverWithKey: mock(() => Promise.reject(original)),
    };
    const useCase = new RecoverWithRecoveryKeyUseCase(
      cryptoService as any,
      createMockLogger() as any,
    );

    try {
      await useCase.execute(
        'user-1',
        'AAAA-BBBB',
        Buffer.alloc(32, 0xab),
        {} as any,
      );
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error).toBe(original);
      expect(error.code).toBe(
        ERROR_DEFINITIONS.RECOVERY_KEY_NOT_CONFIGURED.code,
      );
    }
  });

  it('wraps non-BusinessException errors in ENCRYPTION_REKEY_FAILED with cause chain', async () => {
    const original = new Error('some unrelated DB failure');
    const cryptoService = {
      recoverWithKey: mock(() => Promise.reject(original)),
    };
    const useCase = new RecoverWithRecoveryKeyUseCase(
      cryptoService as any,
      createMockLogger() as any,
    );

    try {
      await useCase.execute(
        'user-1',
        'AAAA-BBBB-CCCC-DDDD',
        Buffer.alloc(32, 0xab),
        {} as any,
      );
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error.code).toBe(ERROR_DEFINITIONS.ENCRYPTION_REKEY_FAILED.code);
      expect(error.cause).toBe(original);
    }
  });

  it('does not log info when recovery fails', async () => {
    const cryptoService = {
      recoverWithKey: mock(() =>
        Promise.reject(
          new BusinessException(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID),
        ),
      ),
    };
    const logger = createMockLogger();
    const useCase = new RecoverWithRecoveryKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    try {
      await useCase.execute(
        'user-1',
        'WRONG',
        Buffer.alloc(32, 0xab),
        {} as any,
      );
      expect.unreachable('Should have thrown');
    } catch {
      // expected
    }

    expect(logger.info).not.toHaveBeenCalled();
  });
});
