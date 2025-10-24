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

  describe('shouldSkip', () => {
    it('should skip throttling for authenticated requests (with Bearer token)', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          }),
        }),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(true);
    });

    it('should NOT skip throttling for public requests (no auth header)', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(false);
    });

    it('should NOT skip throttling for requests with invalid auth format', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Basic user:password',
            },
          }),
        }),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(false);
    });

    it('should NOT skip throttling if authorization header is malformed', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer',
            },
          }),
        }),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      // "Bearer" without space and token is still considered valid format
      // The AuthGuard will reject it later
      expect(shouldSkip).toBe(false);
    });

    it('should skip throttling even with invalid JWT (AuthGuard will handle validation)', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer invalid-token-here',
            },
          }),
        }),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      // We skip throttling for any request with "Bearer <token>"
      // The AuthGuard will validate the token and reject if invalid
      expect(shouldSkip).toBe(true);
    });
  });
});
