import { describe, expect, it } from 'bun:test';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { EncryptionController } from './encryption.controller';

type TestContext = {
  getHandler: () => unknown;
  getClass: () => unknown;
  switchToHttp: () => {
    getRequest: () => { ip: string; headers: Record<string, string> };
    getResponse: () => { header: (name: string, value: unknown) => void };
  };
};

const createContext = (handler: unknown): TestContext => {
  const req = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'bun-test' },
  };
  const res = {
    header: () => undefined,
  };

  return {
    getHandler: () => handler,
    getClass: () => EncryptionController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  };
};

const createGuard = async (): Promise<ThrottlerGuard> => {
  const guard = new ThrottlerGuard(
    {
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 1000,
        },
      ],
    },
    new ThrottlerStorageService(),
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
};

const runAttempts = async (
  guard: ThrottlerGuard,
  handler: unknown,
  attempts: number,
): Promise<void> => {
  for (let i = 0; i < attempts; i += 1) {
    const context = createContext(handler);
    await guard.canActivate(context as any);
  }
};

describe('EncryptionController Rate Limiting', () => {
  it('throttles validate-key after 5 attempts per minute', async () => {
    const guard = await createGuard();
    const handler = EncryptionController.prototype.validateKey;

    await runAttempts(guard, handler, 5);

    try {
      await guard.canActivate(createContext(handler) as any);
      expect.unreachable('Expected throttling exception after 5 attempts');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });

  it('throttles rekey after 3 attempts per hour', async () => {
    const guard = await createGuard();
    const handler = EncryptionController.prototype.rekey;

    await runAttempts(guard, handler, 3);

    try {
      await guard.canActivate(createContext(handler) as any);
      expect.unreachable('Expected throttling exception after 3 attempts');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });

  it('throttles recover after 5 attempts per hour', async () => {
    const guard = await createGuard();
    const handler = EncryptionController.prototype.recover;

    await runAttempts(guard, handler, 5);

    try {
      await guard.canActivate(createContext(handler) as any);
      expect.unreachable('Expected throttling exception after 5 attempts');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });
});
