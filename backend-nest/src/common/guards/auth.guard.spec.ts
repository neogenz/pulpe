import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SupabaseService } from '@modules/supabase/supabase.service';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectErrorThrown,
  MockSupabaseClient,
} from '../../test/test-utils-simple';

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
          provide: `PinoLogger:${AuthGuard.name}`,
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

    it('should throw UnauthorizedException when no authorization header', async () => {
      // Arrange
      const mockContext = createMockExecutionContext();

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        UnauthorizedException,
        "Token d'accès requis",
      );
    });

    it('should throw UnauthorizedException when no token in header', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Invalid header format');

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        UnauthorizedException,
        "Token d'accès requis",
      );
    });

    it('should throw UnauthorizedException when Bearer prefix missing', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('token-without-bearer');

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        UnauthorizedException,
        "Token d'accès requis",
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer invalid-token');

      mockSupabaseClient.setMockData(null).setMockError(null);

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        UnauthorizedException,
        "Token d'accès invalide ou expiré",
      );
    });

    it('should throw UnauthorizedException when Supabase returns error', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer expired-token');

      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: 'Token expired' });

      // Act & Assert
      await expectErrorThrown(
        () => authGuard.canActivate(mockContext),
        UnauthorizedException,
        "Token d'accès invalide ou expiré",
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
        UnauthorizedException,
        "Erreur d'authentification",
      );

      // Restore
      mockSupabaseClient.auth.getUser = originalGetUser;
    });

    it('should set user and supabase client on request when authenticated', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockRequest = { headers: { authorization: 'Bearer valid-token' } };
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
  });
});
