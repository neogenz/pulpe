import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, OptionalAuthGuard } from './auth.guard';
import { SupabaseService } from '@modules/supabase/supabase.service';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createTestingModuleBuilder,
  expectErrorThrown,
  testErrorSilencer,
  MockSupabaseClient,
} from '../../test/test-utils';

describe('AuthGuard', () => {
  let authGuard: AuthGuard;
  let _supabaseService: SupabaseService;
  let _reflector: Reflector;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(async () => {
    const { mockSupabaseService } = createTestingModuleBuilder();
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    // Update the mock to return our mockClient
    mockSupabaseService.createAuthenticatedClient = () =>
      mockSupabaseClient as any;

    const mockReflector = {
      get: () => undefined,
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
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    _supabaseService = module.get<SupabaseService>(SupabaseService);
    _reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization,
          },
        }),
      }),
    }) as any;

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
      } as any;

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
      expect((mockRequest as any).user).toEqual(mockUser);
    });
  });
});

describe('OptionalAuthGuard', () => {
  let optionalAuthGuard: OptionalAuthGuard;
  let _supabaseService: SupabaseService;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(async () => {
    const { mockSupabaseService } = createTestingModuleBuilder();
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    // Update the mock to return our mockClient
    mockSupabaseService.createAuthenticatedClient = () =>
      mockSupabaseClient as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionalAuthGuard,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    optionalAuthGuard = module.get<OptionalAuthGuard>(OptionalAuthGuard);
    _supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  const createMockExecutionContext = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization,
          },
        }),
      }),
    }) as any;

  describe('canActivate', () => {
    it('should return true when no authorization header', async () => {
      // Arrange
      const mockContext = createMockExecutionContext();

      // Act
      const result = await optionalAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true and set user when valid token provided', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockRequest = { headers: { authorization: 'Bearer valid-token' } };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any;

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
      const result = await optionalAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty('user');
      expect(mockRequest).toHaveProperty('supabase');
    });

    it('should return true even when invalid token provided', async () => {
      // Arrange
      const mockContext = createMockExecutionContext('Bearer invalid-token');

      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: 'Invalid token' });

      // Act
      const result = await optionalAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when authentication fails unexpectedly', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
        // Arrange
        const mockContext = createMockExecutionContext('Bearer valid-token');

        // Mock the auth.getUser to throw an error
        const originalGetUser = mockSupabaseClient.auth.getUser;
        mockSupabaseClient.auth.getUser = () =>
          Promise.reject(new Error('Network error'));

        // Act
        const result = await optionalAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBe(true);

        // Restore
        mockSupabaseClient.auth.getUser = originalGetUser;
      });
    });
  });
});
