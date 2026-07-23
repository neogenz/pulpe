import { describe, it, expect, beforeEach } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { IpBlacklistMiddleware } from './ip-blacklist.middleware';

const BLACKLISTED_IP = '203.0.113.66';
const INNOCENT_IP = '198.51.100.1';

describe('IpBlacklistMiddleware', () => {
  let middleware: IpBlacklistMiddleware;
  let statusCalls: number[];
  let nextCalls: number;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const createMiddleware = (blacklist: string) => {
    const configService = {
      get: (key: string, defaultValue?: string) =>
        key === 'IP_BLACKLIST' ? blacklist : defaultValue,
    };
    const logger = {
      info: () => {},
      warn: () => {},
    };
    return new IpBlacklistMiddleware(configService as never, logger as never);
  };

  const createRequest = (overrides: {
    headers?: Record<string, string>;
    ip?: string;
  }): Request =>
    ({
      headers: overrides.headers ?? {},
      ip: overrides.ip,
      url: '/api/v1/budgets',
    }) as unknown as Request;

  beforeEach(() => {
    statusCalls = [];
    nextCalls = 0;
    mockResponse = {
      status: (code: number) => {
        statusCalls.push(code);
        return { json: () => mockResponse } as unknown as Response;
      },
    } as Partial<Response>;
    mockNext = () => {
      nextCalls++;
    };
    middleware = createMiddleware(BLACKLISTED_IP);
  });

  it('should block a blacklisted X-Real-IP even when X-Forwarded-For is spoofed innocent', () => {
    const request = createRequest({
      headers: {
        'x-real-ip': BLACKLISTED_IP,
        'x-forwarded-for': INNOCENT_IP,
      },
      ip: INNOCENT_IP,
    });

    middleware.use(request, mockResponse as Response, mockNext);

    expect(statusCalls).toEqual([403]);
    expect(nextCalls).toBe(0);
  });

  it('should ignore a client-forged X-Forwarded-For (only X-Real-IP and req.ip count)', () => {
    const request = createRequest({
      headers: { 'x-forwarded-for': BLACKLISTED_IP },
      ip: INNOCENT_IP,
    });

    middleware.use(request, mockResponse as Response, mockNext);

    expect(statusCalls).toEqual([]);
    expect(nextCalls).toBe(1);
  });

  it('should fall back to req.ip when X-Real-IP is absent', () => {
    const request = createRequest({ ip: BLACKLISTED_IP });

    middleware.use(request, mockResponse as Response, mockNext);

    expect(statusCalls).toEqual([403]);
    expect(nextCalls).toBe(0);
  });

  it('should pass through when the blacklist is empty', () => {
    const emptyMiddleware = createMiddleware('');
    const request = createRequest({
      headers: { 'x-real-ip': BLACKLISTED_IP },
    });

    emptyMiddleware.use(request, mockResponse as Response, mockNext);

    expect(statusCalls).toEqual([]);
    expect(nextCalls).toBe(1);
  });
});
