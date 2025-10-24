import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkipAuthenticatedThrottlerGuard } from './throttler-skip.guard';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('SkipAuthenticatedThrottlerGuard', () => {
  let guard: SkipAuthenticatedThrottlerGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new SkipAuthenticatedThrottlerGuard(
      reflector,
      [],
      {} as any, // ConfigService mock
      {} as any, // StorageService mock
    );
  });

  describe('shouldSkip - Public Endpoints', () => {
    it('should NOT skip throttling on public endpoints even with Bearer token', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token-here',
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock the endpoint as @Public
      reflector.getAllAndOverride = () => true;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      // SECURITY: Public endpoints are ALWAYS rate limited
      expect(shouldSkip).toBe(false);
    });

    it('should NOT skip throttling on public endpoints without auth', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock the endpoint as @Public
      reflector.getAllAndOverride = () => true;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(false);
    });
  });

  describe('shouldSkip - Protected Endpoints', () => {
    it('should skip throttling for authenticated requests on protected endpoints', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock the endpoint as protected (NOT @Public)
      reflector.getAllAndOverride = () => false;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(true);
    });

    it('should NOT skip throttling for protected endpoints without auth', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock the endpoint as protected (NOT @Public)
      reflector.getAllAndOverride = () => false;

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
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock the endpoint as protected
      reflector.getAllAndOverride = () => false;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      expect(shouldSkip).toBe(false);
    });
  });

  describe('Security - Bypass Prevention', () => {
    it('should prevent rate limit bypass on /demo/session with fake Bearer token', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/v1/demo/session',
            headers: {
              authorization: 'Bearer fake-token-to-bypass-rate-limit',
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Mock /demo/session as @Public (which it is)
      reflector.getAllAndOverride = () => true;

      const shouldSkip = await guard['shouldSkip'](mockContext);

      // CRITICAL: Should NOT skip throttling even with Bearer token
      // This prevents attackers from bypassing rate limiting on demo endpoint
      expect(shouldSkip).toBe(false);
    });
  });
});
