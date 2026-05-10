import { describe, it, expect, mock } from 'bun:test';
import { ValidateUserKeyUseCase } from './validate-user-key.use-case';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const createMockLogger = () => ({
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
});

describe('ValidateUserKeyUseCase', () => {
  it('returns void when crypto service confirms key validity', async () => {
    const cryptoService = {
      verifyAndEnsureKeyCheck: mock(() => Promise.resolve(true)),
    };
    const logger = createMockLogger();
    const useCase = new ValidateUserKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    await useCase.execute('user-1', Buffer.alloc(32, 0xab));

    expect(cryptoService.verifyAndEnsureKeyCheck).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws ENCRYPTION_KEY_CHECK_FAILED and warns when crypto service returns false', async () => {
    const cryptoService = {
      verifyAndEnsureKeyCheck: mock(() => Promise.resolve(false)),
    };
    const logger = createMockLogger();
    const useCase = new ValidateUserKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    try {
      await useCase.execute('user-1', Buffer.alloc(32, 0xab));
      expect.unreachable('Should have thrown BusinessException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error.code).toBe(
        ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED.code,
      );
    }

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { userId: 'user-1', operation: 'validate_key.failed' },
      'Client key verification failed',
    );
  });

  it('forwards userId and clientKey to crypto service unchanged', async () => {
    const calls: any[] = [];
    const cryptoService = {
      verifyAndEnsureKeyCheck: mock((...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(true);
      }),
    };
    const useCase = new ValidateUserKeyUseCase(
      cryptoService as any,
      createMockLogger() as any,
    );
    const buffer = Buffer.alloc(32, 0xcd);

    await useCase.execute('user-42', buffer);

    expect(calls[0][0]).toBe('user-42');
    expect(calls[0][1]).toBe(buffer);
  });
});
