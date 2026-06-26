import { describe, expect, it } from 'bun:test';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import {
  DEMO_UNVERIFIED_HOURLY_LIMIT,
  isUnverifiedDemoSessionRequest,
} from './throttler.config';

const DEMO_SESSION_URL = '/api/v1/demo/session';
const REAL_TOKEN = 'cf-turnstile-real-token';

const predicateContext = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('isUnverifiedDemoSessionRequest', () => {
  it('returns true for a demo session with an empty token', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({ url: DEMO_SESSION_URL, body: { turnstileToken: '' } }),
    );

    expect(result).toBe(true);
  });

  it('returns true for a demo session with a missing token', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({ url: DEMO_SESSION_URL, body: {} }),
    );

    expect(result).toBe(true);
  });

  it('returns false for a demo session carrying a real token', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({
        url: DEMO_SESSION_URL,
        body: { turnstileToken: REAL_TOKEN },
      }),
    );

    expect(result).toBe(false);
  });

  it('returns false for non-demo endpoints even with an empty token', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({
        url: '/api/v1/budgets',
        body: { turnstileToken: '' },
      }),
    );

    expect(result).toBe(false);
  });

  it('returns false for the dev-only demo cleanup endpoint', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({ url: '/api/v1/demo/cleanup', body: {} }),
    );

    expect(result).toBe(false);
  });

  it('still matches when the path casing is varied (Express routes case-insensitively)', () => {
    const result = isUnverifiedDemoSessionRequest(
      predicateContext({
        url: '/api/v1/DEMO/Session',
        body: { turnstileToken: '' },
      }),
    );

    expect(result).toBe(true);
  });
});

interface GuardRequest {
  ip: string;
  ips: string[];
  url: string;
  headers: Record<string, string>;
  body: { turnstileToken?: string };
}

const guardContext = (
  token: string | undefined,
  url: string = DEMO_SESSION_URL,
  ip: string = '203.0.113.7',
): ExecutionContext => {
  const request: GuardRequest = {
    ip,
    ips: [],
    url,
    headers: { 'user-agent': 'bun-test' },
    body: token === undefined ? {} : { turnstileToken: token },
  };
  const response = { header: () => undefined };

  return {
    getHandler: () => () => undefined,
    getClass: () => class DummyController {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
};

const createDemoUnverifiedGuard = async (): Promise<ThrottlerGuard> => {
  const guard = new ThrottlerGuard(
    {
      throttlers: [
        {
          name: 'demoUnverified',
          ttl: 3600000,
          limit: DEMO_UNVERIFIED_HOURLY_LIMIT,
          skipIf: (context: ExecutionContext) =>
            !isUnverifiedDemoSessionRequest(context),
        },
      ],
    },
    new ThrottlerStorageService(),
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
};

describe('demoUnverified throttler', () => {
  it(`blocks empty-token demo creation after ${DEMO_UNVERIFIED_HOURLY_LIMIT} requests from one IP`, async () => {
    const guard = await createDemoUnverifiedGuard();

    for (let i = 0; i < DEMO_UNVERIFIED_HOURLY_LIMIT; i += 1) {
      await guard.canActivate(guardContext(''));
    }

    try {
      await guard.canActivate(guardContext(''));
      expect.unreachable('Expected throttling past the unverified limit');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });

  it('never throttles verified-token demo creation', async () => {
    const guard = await createDemoUnverifiedGuard();

    for (let i = 0; i < DEMO_UNVERIFIED_HOURLY_LIMIT * 3; i += 1) {
      const allowed = await guard.canActivate(guardContext(REAL_TOKEN));
      expect(allowed).toBe(true);
    }
  });

  it('still caps empty-token creation on a case-varied path', async () => {
    const guard = await createDemoUnverifiedGuard();
    const casedUrl = '/api/v1/DEMO/Session';

    for (let i = 0; i < DEMO_UNVERIFIED_HOURLY_LIMIT; i += 1) {
      await guard.canActivate(guardContext('', casedUrl));
    }

    try {
      await guard.canActivate(guardContext('', casedUrl));
      expect.unreachable('Case-varied path must not dodge the unverified cap');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });
});
