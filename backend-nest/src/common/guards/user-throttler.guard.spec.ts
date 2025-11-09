import { UserThrottlerGuard } from './user-throttler.guard';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
} from '../../test/test-mocks';
import type { SupabaseService } from '@modules/supabase/supabase.service';

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
});
