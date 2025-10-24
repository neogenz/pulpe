import { ExecutionContext } from '@nestjs/common';
import { SkipAuthenticatedThrottlerGuard } from './throttler-skip.guard';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('SkipAuthenticatedThrottlerGuard', () => {
  let guard: SkipAuthenticatedThrottlerGuard;

  beforeEach(() => {
    guard = new SkipAuthenticatedThrottlerGuard(
      [],
      {} as any, // ConfigService mock
      {} as any, // StorageService mock
      {} as any, // Reflector mock
    );
  });

  describe('getTracker', () => {
    it('should return user ID for authenticated requests', async () => {
      // Create a mock JWT with user ID
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const payload = { sub: userId, email: 'test@example.com' };

      // Create JWT manually (header.payload.signature)
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
      ).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
      );
      const signature = 'fake-signature';
      const token = `${header}.${payloadB64}.${signature}`;

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](req);

      expect(tracker).toBe(`user:${userId}`);
    });

    it('should return IP for public requests (no auth header)', async () => {
      const req = {
        headers: {},
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](req);

      expect(tracker).toBe('192.168.1.1');
    });

    it('should return IP for invalid JWT tokens', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](req);

      expect(tracker).toBe('192.168.1.1');
    });

    it('should return unknown if no IP is available', async () => {
      const req = {
        headers: {},
        ip: undefined,
      };

      const tracker = await guard['getTracker'](req);

      expect(tracker).toBe('unknown');
    });
  });

  describe('getThrottlerConfig', () => {
    it('should return demo config for demo session endpoint', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/v1/demo/session',
          }),
        }),
      } as ExecutionContext;

      const config = await guard['getThrottlerConfig'](mockContext);

      expect(config).toEqual({ name: 'demo' });
    });

    it('should return default config for authenticated endpoints', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/v1/budgets',
          }),
        }),
      } as ExecutionContext;

      const config = await guard['getThrottlerConfig'](mockContext);

      expect(config).toBeUndefined();
    });
  });

  describe('decodeJwtPayload', () => {
    it('should decode a valid JWT payload', () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };

      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
      ).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
      );
      const signature = 'fake-signature';
      const token = `${header}.${payloadB64}.${signature}`;

      const decoded = guard['decodeJwtPayload'](token);

      expect(decoded).toEqual(payload);
    });

    it('should return null for malformed tokens', () => {
      const decoded = guard['decodeJwtPayload']('invalid-token');

      expect(decoded).toBeNull();
    });

    it('should return null for tokens with wrong number of parts', () => {
      const decoded = guard['decodeJwtPayload']('part1.part2');

      expect(decoded).toBeNull();
    });
  });
});
