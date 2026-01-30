import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectErrorThrown,
  MockSupabaseClient,
} from '../../test/test-mocks';

describe('AuthGuard', () => {
  let authGuard: AuthGuard;
  let _supabaseService: SupabaseService;
  let _reflector: Reflector;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockSupabaseService = {
      createAuthenticatedClient: () => mockSupabaseClient as any,
      getClient: () => mockSupabaseClient as any,
      getServiceRoleClient: () => mockSupabaseClient as any,
    };

    const mockReflector = {
      get: () => undefined,
    };

    const mockPinoLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: `INFO_LOGGER:${AuthGuard.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    _supabaseService = module.get<SupabaseService>(SupabaseService);
    _reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (
    authorization?: string,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization,
            'x-client-key': 'ab'.repeat(32),
          },
        }),
      }),
    }) as ExecutionContext;

  describe('canActivate', () => {
    it('should return true for valid authentication token', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockContext = createMockExecutionContext('Bearer valid-token');

      // Set up the auth.getUser mock to return the user
      mockSupabaseClient.setMockData(mockUser).setMockError(null);

      // Act
      const result = await authGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw BusinessException when no authorization header', async () => {
      // Arrange
      const mockContext = createMockExecutionContext();

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Authentication token missing',
      );
    });

    it('should throw BusinessException when no token in header', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Invalid header format');

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Authentication token missing',
      );
    });

    it('should throw BusinessException when Bearer prefix missing', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('token-without-bearer');

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Authentication token missing',
      );
    });

    it('should throw BusinessException when user not found', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer invalid-token');

      mockSupabaseClient.setMockData(null).setMockError(null);

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Invalid authentication token',
      );
    });

    it('should throw BusinessException when Supabase returns error', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer expired-token');

      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: 'Token expired' });

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Invalid authentication token',
      );
    });

    it('should handle unexpected errors during authentication', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer valid-token');

      // Mock the auth.getUser to throw an error
      const originalGetUser = mockSupabaseClient.auth.getUser;
      mockSupabaseClient.auth.getUser = () =>
        Promise.reject(new Error('Network error'));

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Unauthorized',
      );

      // Restore
      mockSupabaseClient.auth.getUser = originalGetUser;
    });

    it('should set user and supabase client on request when authenticated', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser({
        accessToken: 'valid-token',
      });
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-client-key': 'ab'.repeat(32),
        },
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      // Set up the auth mock to return a user in the expected format
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

      // Act
      const result = await authGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty('user');
      expect(mockRequest).toHaveProperty('supabase');
      expect(
        (mockRequest as typeof mockRequest & { user: unknown }).user,
      ).toEqual(mockUser);
    });

    it('should reuse cached user from UserThrottlerGuard when available', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser({
        accessToken: 'valid-token',
      });
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-client-key': 'ab'.repeat(32),
        },
        __throttlerUserCache: mockUser, // Simulates cache populated by UserThrottlerGuard
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      // Act
      const result = await authGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty('user');
      expect(mockRequest).toHaveProperty('supabase');
      expect(
        (mockRequest as typeof mockRequest & { user: unknown }).user,
      ).toEqual(mockUser);
      // Verify Supabase auth.getUser() was NOT called (cache was used)
      // The mock would have been called if we went through normal flow
    });

    it('should fall back to normal auth flow when cache is null', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser({
        accessToken: 'valid-token',
      });
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-client-key': 'ab'.repeat(32),
        },
        __throttlerUserCache: null, // Cache indicates auth failed in throttler
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

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

      // Act
      const result = await authGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty('user');
      expect(
        (mockRequest as typeof mockRequest & { user: unknown }).user,
      ).toEqual(mockUser);
    });

    it('should handle errors in cache branch gracefully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-client-key': 'ab'.repeat(32),
        },
        __throttlerUserCache: mockUser, // Cache présent
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      // Mock createAuthenticatedClient to throw
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthGuard,
          {
            provide: SupabaseService,
            useValue: {
              createAuthenticatedClient: () => {
                throw new Error('Network error');
              },
            },
          },
          {
            provide: Reflector,
            useValue: { get: () => undefined },
          },
          {
            provide: `INFO_LOGGER:${AuthGuard.name}`,
            useValue: {
              error: () => {},
              debug: () => {},
            },
          },
        ],
      }).compile();

      const guardWithFailingClient = module.get<AuthGuard>(AuthGuard);

      // Act & Assert
      await expectErrorThrown(
        () => guardWithFailingClient.canActivate(mockContext),
        BusinessException,
        'Unauthorized',
      );
    });

    it('should throw BusinessException when user account is scheduled for deletion', async () => {
      // Arrange
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-client-key': 'ab'.repeat(32),
        },
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      // Set up the auth mock to return a user with scheduledDeletionAt
      mockSupabaseClient
        .setMockData({
          id: 'user-scheduled-deletion',
          email: 'scheduled@example.com',
          user_metadata: {
            firstName: 'John',
            lastName: 'Doe',
            scheduledDeletionAt: '2025-01-20T12:00:00.000Z',
          },
        })
        .setMockError(null);

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        BusinessException,
        'Account is scheduled for deletion',
      );
    });
  });
});
