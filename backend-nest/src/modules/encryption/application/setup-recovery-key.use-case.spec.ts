import { describe, it, expect, mock } from 'bun:test';
import { SetupRecoveryKeyUseCase } from './setup-recovery-key.use-case';

const createMockLogger = () => ({
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
});

describe('SetupRecoveryKeyUseCase', () => {
  it('returns the formatted recovery key from crypto service', async () => {
    const cryptoService = {
      createRecoveryKey: mock(() =>
        Promise.resolve({ formatted: 'XXXX-YYYY-ZZZZ-1234' }),
      ),
    };
    const useCase = new SetupRecoveryKeyUseCase(
      cryptoService as any,
      createMockLogger() as any,
    );

    const result = await useCase.execute('user-1', Buffer.alloc(32, 0xab));

    expect(result).toEqual({ recoveryKey: 'XXXX-YYYY-ZZZZ-1234' });
  });

  it('logs an info event with recovery_key.create operation on success', async () => {
    const cryptoService = {
      createRecoveryKey: mock(() =>
        Promise.resolve({ formatted: 'AAAA-BBBB-CCCC-DDDD' }),
      ),
    };
    const logger = createMockLogger();
    const useCase = new SetupRecoveryKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    await useCase.execute('user-99', Buffer.alloc(32, 0xab));

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { userId: 'user-99', operation: 'recovery_key.create' },
      'Recovery key created',
    );
  });

  it('propagates errors from crypto service without logging info', async () => {
    const cryptoService = {
      createRecoveryKey: mock(() => Promise.reject(new Error('boom'))),
    };
    const logger = createMockLogger();
    const useCase = new SetupRecoveryKeyUseCase(
      cryptoService as any,
      logger as any,
    );

    try {
      await useCase.execute('user-1', Buffer.alloc(32, 0xab));
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error.message).toBe('boom');
    }

    expect(logger.info).not.toHaveBeenCalled();
  });
});
