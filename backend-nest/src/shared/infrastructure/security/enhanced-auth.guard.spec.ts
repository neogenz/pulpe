import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  EnhancedAuthGuard,
  PUBLIC_KEY,
  ROLES_KEY,
} from './enhanced-auth.guard';
import { SupabaseService } from '../../../modules/supabase/supabase.service';
import { PinoLogger } from 'nestjs-pino';

describe('EnhancedAuthGuard', () => {
  let guard: EnhancedAuthGuard;
  let supabaseService: SupabaseService;
  let reflector: Reflector;
  let logger: PinoLogger;
  let mockExecutionContext: ExecutionContext;

  const mockRequest = {
    headers: {},
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'authenticated',
    user_metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    last_sign_in_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Create mocks
    supabaseService = {
      getClient: mock(() => ({
        auth: {
          getUser: mock(() =>
            Promise.resolve({ data: { user: mockUser }, error: null }),
          ),
        },
      })),
    } as any;

    reflector = {
      getAllAndOverride: mock(() => undefined),
    } as any;

    logger = {
      setContext: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    } as any;

    mockExecutionContext = {
      switchToHttp: mock(() => ({
        getRequest: () => mockRequest,
      })),
      getHandler: mock(() => {}),
      getClass: mock(() => {}),
    } as any;

    guard = new EnhancedAuthGuard(supabaseService, reflector, logger);
  });

  describe('canActivate', () => {
    it('should allow access to public endpoints', async () => {
      // Arrange
      (reflector.getAllAndOverride as any).mockReturnValueOnce(true);

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(supabaseService.getClient).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      // Arrange
      (reflector.getAllAndOverride as any).mockReturnValue(false);

      // Act & Assert
      expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('No authentication token provided'),
      );
      expect(logger.warn).toHaveBeenCalledWith({
        operation: 'auth_guard_no_token',
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      });
    });

    it('should validate token and allow access for authenticated user', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (reflector.getAllAndOverride as any).mockReturnValue(false);

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect((mockRequest as any).user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        metadata: mockUser.user_metadata,
        role: mockUser.role,
        createdAt: mockUser.created_at,
        lastSignInAt: mockUser.last_sign_in_at,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'auth_guard_success',
          userId: mockUser.id,
          path: '/api/test',
          method: 'GET',
        }),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (reflector.getAllAndOverride as any).mockReturnValue(false);
      const errorMessage = 'Invalid token';
      (supabaseService.getClient as any).mockReturnValueOnce({
        auth: {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: errorMessage },
            }),
          ),
        },
      });

      // Act & Assert
      expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Invalid authentication token'),
      );
    });

    it('should check roles and allow access when user has required role', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      const adminUser = { ...mockUser, role: 'admin' };
      (reflector.getAllAndOverride as any)
        .mockReturnValueOnce(false) // isPublic
        .mockReturnValueOnce(['admin']); // requiredRoles
      (supabaseService.getClient as any).mockReturnValueOnce({
        auth: {
          getUser: mock(() =>
            Promise.resolve({ data: { user: adminUser }, error: null }),
          ),
        },
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required role', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (reflector.getAllAndOverride as any)
        .mockReturnValueOnce(false) // isPublic
        .mockReturnValueOnce(['admin']); // requiredRoles

      // Act & Assert
      expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ForbiddenException('Insufficient permissions'),
      );

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'auth_guard_insufficient_role',
          userId: mockUser.id,
          requiredRoles: ['admin'],
          userRole: mockUser.role,
        }),
      );
    });

    it('should check roles in user metadata', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      const userWithMetadataRoles = {
        ...mockUser,
        user_metadata: { roles: ['admin', 'moderator'] },
      };
      (reflector.getAllAndOverride as any)
        .mockReturnValueOnce(false) // isPublic
        .mockReturnValueOnce(['moderator']); // requiredRoles
      (supabaseService.getClient as any).mockReturnValueOnce({
        auth: {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: userWithMetadataRoles },
              error: null,
            }),
          ),
        },
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (reflector.getAllAndOverride as any).mockReturnValue(false);
      (supabaseService.getClient as any).mockReturnValueOnce({
        auth: {
          getUser: mock(() => Promise.reject(new Error('Network error'))),
        },
      });

      // Act & Assert
      expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith({
        operation: 'auth_guard_error',
        path: '/api/test',
        method: 'GET',
        error: 'Network error',
      });
    });

    it('should extract token correctly from different authorization formats', async () => {
      // Arrange - test with lowercase bearer
      mockRequest.headers = { authorization: 'bearer valid-token' };
      (reflector.getAllAndOverride as any).mockReturnValue(false);

      // Act & Assert - should fail because we only accept 'Bearer' with capital B
      expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('No authentication token provided'),
      );
    });
  });
});
