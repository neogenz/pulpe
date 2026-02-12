import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { lastValueFrom, of, throwError } from 'rxjs';
import { SKIP_BACKFILL } from '@common/decorators/skip-backfill.decorator';
import { EncryptionBackfillInterceptor } from './encryption-backfill.interceptor';

function createExecutionContext(
  userId: string,
  clientKey: Buffer = Buffer.alloc(32, 0xab),
): ExecutionContext {
  const request = {
    user: { id: userId, clientKey },
    supabase: { token: 'supabase-client' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => function testHandler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('EncryptionBackfillInterceptor', () => {
  let interceptor: EncryptionBackfillInterceptor;
  let reflector: Reflector;
  let encryptionService: {
    ensureUserDEK: ReturnType<typeof mock>;
  };
  let backfillService: {
    backfillUserData: ReturnType<typeof mock>;
  };
  let handler: CallHandler;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: mock(() => false),
    } as unknown as Reflector;

    encryptionService = {
      ensureUserDEK: mock(() => Promise.resolve(Buffer.alloc(32, 0xcd))),
    };

    backfillService = {
      backfillUserData: mock(() => Promise.resolve()),
    };

    interceptor = new EncryptionBackfillInterceptor(
      reflector,
      backfillService as any,
      encryptionService as any,
    );

    handler = {
      handle: () => of(null),
    };
  });

  it('should run backfill only once per tracked user', async () => {
    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-1'), handler),
    );
    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-1'), handler),
    );

    const ensureCalls = encryptionService.ensureUserDEK.mock
      .calls as unknown[][];
    const userOneCalls = ensureCalls.filter((call) => call[0] === 'user-1');

    expect(userOneCalls).toHaveLength(1);
  });

  it('should prune expired users when tracking a new user', async () => {
    const originalNow = Date.now;

    let currentTime = 1000000;
    Date.now = () => currentTime;

    await lastValueFrom(
      interceptor.intercept(createExecutionContext('expired-user'), handler),
    );

    currentTime += 25 * 60 * 60 * 1000;

    await lastValueFrom(
      interceptor.intercept(createExecutionContext('new-user'), handler),
    );

    await lastValueFrom(
      interceptor.intercept(createExecutionContext('expired-user'), handler),
    );

    const ensureCalls = encryptionService.ensureUserDEK.mock
      .calls as unknown[][];
    const expiredUserCalls = ensureCalls.filter(
      (call) => call[0] === 'expired-user',
    );
    expect(expiredUserCalls).toHaveLength(2);

    Date.now = originalNow;
  });

  it('should evict old tracked users to avoid unbounded memory growth', async () => {
    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-0'), handler),
    );

    for (let i = 1; i <= 1100; i++) {
      await lastValueFrom(
        interceptor.intercept(createExecutionContext(`user-${i}`), handler),
      );
    }

    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-0'), handler),
    );

    const ensureCalls = encryptionService.ensureUserDEK.mock
      .calls as unknown[][];
    const userZeroCalls = ensureCalls.filter((call) => call[0] === 'user-0');

    expect(userZeroCalls).toHaveLength(2);
  });

  it('should skip backfill when SKIP_BACKFILL metadata is set', async () => {
    (reflector as any).getAllAndOverride = mock(
      (key: string) => key === SKIP_BACKFILL,
    );

    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-skip'), handler),
    );

    expect(encryptionService.ensureUserDEK).not.toHaveBeenCalled();
    expect(backfillService.backfillUserData).not.toHaveBeenCalled();
  });

  it('should not mark user as processed when handler errors, allowing retry', async () => {
    const errorHandler: CallHandler = {
      handle: () => throwError(() => new Error('request failed')),
    };

    // First request errors — user should NOT be tracked
    try {
      await lastValueFrom(
        interceptor.intercept(createExecutionContext('user-err'), errorHandler),
      );
    } catch {
      // expected
    }

    expect(encryptionService.ensureUserDEK).not.toHaveBeenCalled();

    // Second request succeeds — backfill should fire
    await lastValueFrom(
      interceptor.intercept(createExecutionContext('user-err'), handler),
    );

    const ensureCalls = encryptionService.ensureUserDEK.mock
      .calls as unknown[][];
    const userErrCalls = ensureCalls.filter((call) => call[0] === 'user-err');
    expect(userErrCalls).toHaveLength(1);
  });
});
