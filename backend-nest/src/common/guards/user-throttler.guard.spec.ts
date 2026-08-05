import { UserThrottlerGuard } from './user-throttler.guard';
import { describe, it, expect, afterEach, beforeEach, mock } from 'bun:test';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
} from '../../test/test-mocks';
import type { SupabaseService } from '@modules/supabase/supabase.service';
import { PUBLIC_THROTTLER_NAME } from '@config/throttler.config';

describe('UserThrottlerGuard', () => {
  let guard: UserThrottlerGuard;
  let mockSupabaseService: SupabaseService;
  let mockLogger: any;
  let mockSupabaseClient: ReturnType<
    typeof createMockSupabaseClient
  >['mockClient'];

  beforeEach(() => {
    // Mock Supabase client setup
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    mockSupabaseService = {
      createAuthenticatedClient: mock(() => mockSupabaseClient as any),
      getClient: mock(() => mockSupabaseClient as any),
      getServiceRoleClient: mock(() => mockSupabaseClient as any),
    } as any;

    // Mock Pino logger
    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
      trace: mock(() => {}),
      fatal: mock(() => {}),
    };

    // Mock ThrottlerGuard dependencies
    const mockThrottlerOptions = {} as any;
    const mockThrottlerStorage = {} as any;
    const mockReflector = {} as any;

    // Create guard with all dependencies (including ThrottlerGuard dependencies)
    guard = new UserThrottlerGuard(
      mockThrottlerOptions,
      mockThrottlerStorage,
      mockReflector,
      mockLogger,
      mockSupabaseService,
    );
  });

  describe('getTracker - User-based tracking', () => {
    it('should generate tracker with user ID for authenticated requests', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData({
          id: mockUser.id,
          email: mockUser.email,
          user_metadata: {
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
          },
        })
        .setMockError(null);

      const mockRequest = {
        headers: { authorization: 'Bearer valid-token' },
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe(`user:${mockUser.id}`);
    });

    it('should use consistent tracker for same user across different IPs', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData({
          id: mockUser.id,
          email: mockUser.email,
          user_metadata: {
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
          },
        })
        .setMockError(null);

      const request1 = {
        headers: { authorization: 'Bearer valid-token' },
        ip: '192.168.1.1',
        ips: [],
      };

      const request2 = {
        headers: { authorization: 'Bearer valid-token' },
        ip: '10.0.0.1',
        ips: [],
      };

      // Act
      const tracker1 = await (guard as any).getTracker(request1);
      const tracker2 = await (guard as any).getTracker(request2);

      // Assert
      expect(tracker1).toBe(tracker2); // Same user = same tracker regardless of IP
      expect(tracker1).toBe(`user:${mockUser.id}`);
    });

    it('should differentiate between different users', async () => {
      // Arrange
      const user1 = createMockAuthenticatedUser({ id: 'user-1' });
      const user2 = createMockAuthenticatedUser({ id: 'user-2' });

      const request1 = {
        headers: { authorization: 'Bearer token1' },
        ip: '192.168.1.1',
      };

      const request2 = {
        headers: { authorization: 'Bearer token2' },
        ip: '192.168.1.1',
      };

      // Mock different users for different tokens
      let callCount = 0;
      mockSupabaseService.createAuthenticatedClient = mock(() => {
        const { mockClient } = createMockSupabaseClient();
        const userData = callCount === 0 ? user1 : user2;
        callCount++;
        mockClient.setMockData({
          id: userData.id,
          email: userData.email,
          user_metadata: {
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        });
        return mockClient as any;
      });

      // Act
      const tracker1 = await (guard as any).getTracker(request1);
      const tracker2 = await (guard as any).getTracker(request2);

      // Assert
      expect(tracker1).not.toBe(tracker2); // Different users = different trackers
      expect(tracker1).toBe('user:user-1');
      expect(tracker2).toBe('user:user-2');
    });
  });

  describe('getTracker - demo routes stay IP-keyed', () => {
    it('should key demo routes by IP even when a valid Bearer token is present', async () => {
      // Arrange - a token minted by a previous POST /demo/session must not
      // become its own throttle bucket, or demo creation is self-minting.
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData({ id: mockUser.id, email: mockUser.email })
        .setMockError(null);

      const mockRequest = {
        url: '/api/v1/demo/session',
        headers: {
          authorization: 'Bearer demo-token-from-previous-session',
          'x-real-ip': '203.0.113.7',
        },
        ip: '203.0.113.7',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('203.0.113.7');
      expect(tracker).not.toContain(`user:${mockUser.id}`);
    });

    it('should still key a demo-prefixed sibling route by user, not IP', async () => {
      // Arrange - `/api/v1/demography` is NOT a demo route: the demo prefix
      // must match `/api/v1/demo/`, not any path that merely starts with it.
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData({ id: mockUser.id, email: mockUser.email })
        .setMockError(null);

      const mockRequest = {
        url: '/api/v1/demography',
        headers: {
          authorization: 'Bearer valid-token',
          'x-real-ip': '203.0.113.9',
        },
        ip: '203.0.113.9',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe(`user:${mockUser.id}`);
    });

    it('should key demo routes by IP regardless of path casing', async () => {
      // Arrange - Express routes case-insensitively
      const mockRequest = {
        url: '/api/v1/DEMO/session',
        headers: { 'x-real-ip': '203.0.113.8' },
        ip: '203.0.113.8',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('203.0.113.8');
    });
  });

  describe('getTracker - IP-based fallback', () => {
    it('should fall back to IP-based tracker for unauthenticated requests', async () => {
      // Arrange
      const mockRequest = {
        ip: '192.168.1.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(typeof tracker).toBe('string');
      expect(tracker).not.toContain('user:'); // Should not have user prefix (IP-based fallback)
      expect(tracker.length).toBeGreaterThan(0); // Should have generated a tracker
    });

    it('should handle missing authorization header gracefully', async () => {
      // Arrange
      const mockRequest = {
        headers: {},
        ip: '10.0.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(typeof tracker).toBe('string');
      expect(tracker).not.toContain('user:');
    });

    it('should fall back to IP when token is invalid', async () => {
      // Arrange
      mockSupabaseClient.setMockData(null).setMockError({
        message: 'Invalid token',
      });

      const mockRequest = {
        headers: { authorization: 'Bearer invalid-token' },
        ip: '172.16.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(tracker).not.toContain('user:'); // Should use IP-based fallback
      expect(tracker.length).toBeGreaterThan(0);
    });

    it('should fall back to IP when Bearer prefix is missing', async () => {
      // Arrange
      const mockRequest = {
        headers: { authorization: 'invalid-format' },
        ip: '192.168.1.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(tracker).not.toContain('user:');
    });

    it('should fall back to IP when Supabase returns no user', async () => {
      // Arrange
      mockSupabaseClient.setMockData(null).setMockError(null);

      const mockRequest = {
        headers: { authorization: 'Bearer expired-token' },
        ip: '10.0.0.5',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(tracker).not.toContain('user:');
    });

    it('should fall back to IP when app_metadata schedules deletion', async () => {
      // Arrange - User with account scheduled for deletion
      mockSupabaseClient
        .setMockData({
          id: 'user-scheduled-deletion',
          email: 'scheduled@example.com',
          app_metadata: {
            scheduledDeletionAt: '2025-01-20T12:00:00.000Z',
          },
          user_metadata: {
            firstName: 'John',
            lastName: 'Doe',
          },
        })
        .setMockError(null);

      const mockRequest = {
        headers: { authorization: 'Bearer valid-token' },
        ip: '192.168.1.100',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert - Should not treat as authenticated user
      expect(tracker).toBeDefined();
      expect(tracker).not.toContain('user:'); // Should fall back to IP-based tracking
      expect(tracker).not.toContain('user-scheduled-deletion');
    });

    it('should ignore a client-owned scheduledDeletionAt claim', async () => {
      mockSupabaseClient
        .setMockData({
          id: 'active-user',
          email: 'active@example.com',
          app_metadata: {},
          user_metadata: {
            scheduledDeletionAt: '2020-01-01T00:00:00.000Z',
          },
        })
        .setMockError(null);

      const tracker = await (guard as any).getTracker({
        headers: { authorization: 'Bearer valid-token' },
        ip: '192.168.1.100',
        ips: [],
      });

      expect(tracker).toBe('user:active-user');
    });
  });

  describe('getTracker - Caching behavior', () => {
    it('should cache user resolution across multiple getTracker calls', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      let authCallCount = 0;

      mockSupabaseService.createAuthenticatedClient = mock(() => {
        const { mockClient } = createMockSupabaseClient();
        authCallCount++;
        mockClient.setMockData({
          id: mockUser.id,
          email: mockUser.email,
          user_metadata: {
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
          },
        });
        return mockClient as any;
      });

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid-token' },
      };

      // Act - Call getTracker twice (simulates NestJS throttler with 2 contexts)
      const tracker1 = await (guard as any).getTracker(mockRequest);
      const tracker2 = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker1).toBe(`user:${mockUser.id}`);
      expect(tracker2).toBe(`user:${mockUser.id}`);
      expect(authCallCount).toBe(1); // Should only call Supabase once, not twice
      expect(mockRequest.__throttlerUserCache).toBeDefined();
      expect(mockRequest.__throttlerUserCache?.id).toBe(mockUser.id);
    });

    it('should cache failed authentication (null) to prevent retries', async () => {
      // Arrange
      let authCallCount = 0;
      mockSupabaseService.createAuthenticatedClient = mock(() => {
        const { mockClient } = createMockSupabaseClient();
        authCallCount++;
        mockClient.setMockData(null).setMockError({ message: 'Invalid token' });
        return mockClient as any;
      });

      const mockRequest: any = {
        headers: { authorization: 'Bearer invalid-token' },
        ip: '192.168.1.1',
        ips: [],
      };

      // Act - Call getTracker twice
      const tracker1 = await (guard as any).getTracker(mockRequest);
      const tracker2 = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker1).toBeDefined();
      expect(tracker1).not.toContain('user:'); // IP-based fallback
      expect(tracker2).toBe(tracker1); // Same IP-based tracker
      expect(authCallCount).toBe(1); // Should only try once, then use cached null
      expect(mockRequest.__throttlerUserCache).toBe(null); // Cached failure
    });
  });

  describe('getTracker - Edge cases', () => {
    it('should handle Supabase client errors gracefully', async () => {
      // Arrange
      mockSupabaseService.createAuthenticatedClient = mock(() => {
        throw new Error('Network error');
      });

      const mockRequest = {
        headers: { authorization: 'Bearer valid-token' },
        ip: '192.168.1.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBeDefined();
      expect(tracker).not.toContain('user:'); // Should fall back to IP-based
      expect(tracker.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalled(); // Should log the error
    });

    it('should handle user without email gracefully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient.setMockData({
        id: mockUser.id,
        email: null, // Missing email
        user_metadata: {},
      });

      const mockRequest = {
        headers: { authorization: 'Bearer valid-token' },
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert - Should still work with ID
      expect(tracker).toBe(`user:${mockUser.id}`);
    });
  });

  describe('getTracker - real client IP behind proxy', () => {
    it('should key on X-Real-IP for unauthenticated requests', async () => {
      // Arrange - Railway sets X-Real-IP to the real connecting client
      const mockRequest = {
        headers: { 'x-real-ip': '198.51.100.42' },
        ip: '100.64.0.1', // Railway internal proxy address
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('198.51.100.42');
    });

    it('should ignore a spoofed X-Forwarded-For and trust X-Real-IP', async () => {
      // Arrange - attacker tries to rotate the throttle key via X-Forwarded-For
      const mockRequest = {
        headers: {
          'x-real-ip': '198.51.100.42',
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        },
        ip: '100.64.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert - the spoofable header must not influence the key
      expect(tracker).toBe('198.51.100.42');
      expect(tracker).not.toContain('1.2.3.4');
    });

    it('should fall back to req.ip when X-Real-IP is absent (local/dev)', async () => {
      // Arrange - no proxy header
      const mockRequest = {
        headers: {},
        ip: '127.0.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('127.0.0.1');
    });

    it('should ignore a malformed X-Real-IP and fall back to req.ip', async () => {
      // Arrange - an unvalidated header value would be a free throttle key:
      // any arbitrary string opens a brand-new empty bucket
      const mockRequest = {
        headers: { 'x-real-ip': 'not-an-ip' },
        ip: '100.64.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('100.64.0.1');
    });

    it('should accept an IPv6 X-Real-IP', async () => {
      // Arrange
      const mockRequest = {
        headers: { 'x-real-ip': '2001:db8::1' },
        ip: '100.64.0.1',
        ips: [],
      };

      // Act
      const tracker = await (guard as any).getTracker(mockRequest);

      // Assert
      expect(tracker).toBe('2001:db8::1');
    });
  });

  describe('handleRequest - public bucket', () => {
    const createThrottlerRequest = (request: unknown) =>
      ({
        throttler: { name: PUBLIC_THROTTLER_NAME },
        context: { switchToHttp: () => ({ getRequest: () => request }) },
      }) as any;

    // The base implementation needs a storage backend we do not wire here, so
    // it is stubbed to observe whether the bucket is consumed at all.
    let throttlerPrototype: any;
    let originalHandleRequest: unknown;
    let consumeBucket: ReturnType<typeof mock>;

    beforeEach(() => {
      // `super.handleRequest` resolves to the first prototype ABOVE
      // UserThrottlerGuard.prototype that owns the method. Walk to that one
      // instead of assuming the chain is exactly two levels deep: an
      // intermediate mixin would otherwise silently move the stub off target,
      // and the assertions below would pass or fail for the wrong reason.
      throttlerPrototype = Object.getPrototypeOf(UserThrottlerGuard.prototype);
      while (
        throttlerPrototype &&
        !Object.prototype.hasOwnProperty.call(
          throttlerPrototype,
          'handleRequest',
        )
      ) {
        throttlerPrototype = Object.getPrototypeOf(throttlerPrototype);
      }
      if (!throttlerPrototype) {
        throw new Error(
          'No parent prototype owns handleRequest — the throttler inheritance chain changed.',
        );
      }
      originalHandleRequest = throttlerPrototype.handleRequest;
      consumeBucket = mock(() => Promise.resolve(true));
      throttlerPrototype.handleRequest = consumeBucket;
    });

    afterEach(() => {
      throttlerPrototype.handleRequest = originalHandleRequest;
    });

    it('should apply the public bucket when the Bearer token does not resolve', async () => {
      // Arrange - a forged header must not lift the caller out of the bucket
      mockSupabaseClient.setMockData(null).setMockError(new Error('invalid'));

      // Act
      await (guard as any).handleRequest(
        createThrottlerRequest({
          headers: { authorization: 'Bearer garbage' },
          ip: '203.0.113.7',
          ips: [],
        }),
      );

      // Assert - the bucket was consumed, not skipped
      expect(consumeBucket).toHaveBeenCalledTimes(1);
    });

    it('should skip the public bucket for a token that resolves to a user', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData({ id: mockUser.id, email: mockUser.email })
        .setMockError(null);

      // Act
      const result = await (guard as any).handleRequest(
        createThrottlerRequest({
          headers: { authorization: 'Bearer valid-token' },
          ip: '203.0.113.7',
          ips: [],
        }),
      );

      // Assert
      expect(result).toBe(true);
      expect(consumeBucket).not.toHaveBeenCalled();
    });
  });
});
