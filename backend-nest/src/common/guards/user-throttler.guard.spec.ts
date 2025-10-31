import { ExecutionContext } from '@nestjs/common';
import { UserThrottlerGuard } from './user-throttler.guard';
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockAuthenticatedUser } from '../../test/test-mocks';

describe('UserThrottlerGuard', () => {
  let guard: UserThrottlerGuard;

  beforeEach(() => {
    // ThrottlerGuard constructor parameters: (options, storage, reflector)
    guard = new UserThrottlerGuard(
      [] as any, // options: ThrottlerModuleOptions (empty array for tests)
      {} as any, // storage: ThrottlerStorage (mock - not used in generateKey)
      {} as any, // reflector: Reflector (mock - not used in generateKey)
    );
  });

  describe('generateKey - User-based tracking', () => {
    it('should generate key with user ID for authenticated requests', () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: mockUser }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key = (guard as any).generateKey(mockContext, 'default', 'default');

      // Assert
      expect(key).toBe(`user:${mockUser.id}:default`);
    });

    it('should use consistent key for same user across different IPs', () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();

      const context1 = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: mockUser,
            ip: '192.168.1.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      const context2 = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: mockUser,
            ip: '10.0.0.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key1 = (guard as any).generateKey(context1, 'default', 'default');
      const key2 = (guard as any).generateKey(context2, 'default', 'default');

      // Assert
      expect(key1).toBe(key2); // Same user = same key regardless of IP
      expect(key1).toBe(`user:${mockUser.id}:default`);
    });

    it('should differentiate between different users', () => {
      // Arrange
      const user1 = createMockAuthenticatedUser({ id: 'user-1' });
      const user2 = createMockAuthenticatedUser({ id: 'user-2' });

      const context1 = {
        switchToHttp: () => ({
          getRequest: () => ({ user: user1, ip: '192.168.1.1' }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      const context2 = {
        switchToHttp: () => ({
          getRequest: () => ({ user: user2, ip: '192.168.1.1' }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key1 = (guard as any).generateKey(context1, 'default', 'default');
      const key2 = (guard as any).generateKey(context2, 'default', 'default');

      // Assert
      expect(key1).not.toBe(key2); // Different users = different keys
      expect(key1).toBe('user:user-1:default');
      expect(key2).toBe('user:user-2:default');
    });
  });

  describe('generateKey - IP-based fallback', () => {
    it('should fall back to IP-based key for unauthenticated requests', () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
            ip: '192.168.1.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key = (guard as any).generateKey(mockContext, 'default', 'default');

      // Assert
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key).not.toContain('user:'); // Should not have user prefix (IP-based fallback)
      expect(key.length).toBeGreaterThan(0); // Should have generated a key
    });

    it('should handle missing user gracefully', () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '10.0.0.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key = (guard as any).generateKey(mockContext, 'demo', 'demo');

      // Assert
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key).not.toContain('user:');
    });

    it('should handle null user', () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
            ip: '172.16.0.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key = (guard as any).generateKey(mockContext, 'default', 'default');

      // Assert
      expect(key).toBeDefined();
      expect(key).not.toContain('user:'); // Should use IP-based fallback
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('generateKey - Edge cases', () => {
    it('should handle user without id property', () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { email: 'test@example.com' }, // Missing id
            ip: '192.168.1.1',
            ips: [],
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key = (guard as any).generateKey(mockContext, 'default', 'default');

      // Assert
      expect(key).toBeDefined();
      expect(key).not.toContain('user:'); // Should fall back to IP-based
      expect(key.length).toBeGreaterThan(0);
    });

    it('should use different suffix for different throttler names', () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: mockUser }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      // Act
      const key1 = (guard as any).generateKey(
        mockContext,
        'default',
        'default',
      );
      const key2 = (guard as any).generateKey(mockContext, 'demo', 'demo');

      // Assert
      expect(key1).toBe(`user:${mockUser.id}:default`);
      expect(key2).toBe(`user:${mockUser.id}:demo`);
      expect(key1).not.toBe(key2);
    });
  });
});
