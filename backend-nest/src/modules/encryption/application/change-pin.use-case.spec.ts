import { describe, it, expect, mock } from 'bun:test';
import { ChangePinUseCase } from './change-pin.use-case';

const createMockLogger = () => ({
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
});

const revoke = { revokeAll: mock(() => Promise.resolve()) };

describe('ChangePinUseCase', () => {
  it('returns the rekey result from crypto service', async () => {
    const expected = {
      keyCheck: 'new-key-check',
      recoveryKey: 'AAAA-BBBB-CCCC-1234',
    };
    const cryptoService = {
      changePinRekey: mock(() => Promise.resolve(expected)),
    };
    const useCase = new ChangePinUseCase(
      cryptoService as any,
      revoke as any,
      createMockLogger() as any,
    );

    const result = await useCase.execute(
      'user-1',
      Buffer.alloc(32, 0xab),
      Buffer.alloc(32, 0xcd),
      {} as any,
      'jwt',
    );

    expect(result).toEqual(expected);
    expect(revoke.revokeAll).toHaveBeenCalledWith('user-1', 'jwt');
  });

  it('logs pin_change.complete with recoveryKeyRegenerated on success', async () => {
    const cryptoService = {
      changePinRekey: mock(() =>
        Promise.resolve({
          keyCheck: 'kc',
          recoveryKey: 'XXXX-YYYY-ZZZZ-DDDD',
        }),
      ),
    };
    const logger = createMockLogger();
    const useCase = new ChangePinUseCase(
      cryptoService as any,
      revoke as any,
      logger as any,
    );

    await useCase.execute(
      'user-7',
      Buffer.alloc(32, 0xab),
      Buffer.alloc(32, 0xcd),
      {} as any,
      'jwt',
    );

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      {
        userId: 'user-7',
        operation: 'pin_change.complete',
        recoveryKeyRegenerated: true,
      },
      'PIN changed and data re-encrypted',
    );
  });

  it('forwards all four args (userId, oldKey, newKey, supabase) to crypto service in order', async () => {
    const calls: any[] = [];
    const cryptoService = {
      changePinRekey: mock((...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({ keyCheck: 'kc', recoveryKey: 'rk' });
      }),
    };
    const useCase = new ChangePinUseCase(
      cryptoService as any,
      revoke as any,
      createMockLogger() as any,
    );

    const oldBuf = Buffer.alloc(32, 0xaa);
    const newBuf = Buffer.alloc(32, 0xbb);
    const supabase = { mock: 'client' } as any;

    await useCase.execute('user-3', oldBuf, newBuf, supabase, 'jwt');

    expect(calls[0][0]).toBe('user-3');
    expect(calls[0][1]).toBe(oldBuf);
    expect(calls[0][2]).toBe(newBuf);
    expect(calls[0][3]).toBe(supabase);
  });

  it('propagates errors without info logging', async () => {
    const cryptoService = {
      changePinRekey: mock(() => Promise.reject(new Error('rekey failed'))),
    };
    const logger = createMockLogger();
    const useCase = new ChangePinUseCase(
      cryptoService as any,
      revoke as any,
      logger as any,
    );

    try {
      await useCase.execute(
        'user-1',
        Buffer.alloc(32, 0xab),
        Buffer.alloc(32, 0xcd),
        {} as any,
        'jwt',
      );
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error.message).toBe('rekey failed');
    }

    expect(logger.info).not.toHaveBeenCalled();
  });
});
