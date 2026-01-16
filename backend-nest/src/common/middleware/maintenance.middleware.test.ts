import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MaintenanceMiddleware } from './maintenance.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('MaintenanceMiddleware', () => {
  let middleware: MaintenanceMiddleware;
  let mockConfigService: { get: (key: string) => string | undefined };
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonCalls: unknown[];
  let statusCalls: number[];
  let nextCalls: number;

  beforeEach(async () => {
    // Reset tracking arrays
    jsonCalls = [];
    statusCalls = [];
    nextCalls = 0;

    mockConfigService = {
      get: () => undefined,
    };

    mockRequest = {};
    mockResponse = {
      status: (code: number) => {
        statusCalls.push(code);
        return {
          json: (body: unknown) => {
            jsonCalls.push(body);
            return mockResponse;
          },
        };
      },
    } as Partial<Response>;
    mockNext = () => {
      nextCalls++;
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceMiddleware,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    middleware = module.get<MaintenanceMiddleware>(MaintenanceMiddleware);
  });

  describe('use', () => {
    it('should call next() when MAINTENANCE_MODE is not set', () => {
      // Arrange
      mockConfigService.get = () => undefined;

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(nextCalls).toBe(1);
      expect(statusCalls.length).toBe(0);
    });

    it('should call next() when MAINTENANCE_MODE is false', () => {
      // Arrange
      mockConfigService.get = () => 'false';

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(nextCalls).toBe(1);
      expect(statusCalls.length).toBe(0);
    });

    it('should call next() when MAINTENANCE_MODE is empty string', () => {
      // Arrange
      mockConfigService.get = () => '';

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(nextCalls).toBe(1);
      expect(statusCalls.length).toBe(0);
    });

    it('should return 503 when MAINTENANCE_MODE is true', () => {
      // Arrange
      mockConfigService.get = () => 'true';

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(nextCalls).toBe(0);
      expect(statusCalls).toContain(503);
      expect(jsonCalls[0]).toEqual({
        statusCode: 503,
        code: 'MAINTENANCE',
        message: 'Application en maintenance. Veuillez réessayer plus tard.',
      });
    });

    it('should return maintenance response with correct structure', () => {
      // Arrange
      mockConfigService.get = () => 'true';

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      const responseBody = jsonCalls[0] as Record<string, unknown>;
      expect(responseBody).toHaveProperty('statusCode', 503);
      expect(responseBody).toHaveProperty('code', 'MAINTENANCE');
      expect(responseBody).toHaveProperty('message');
    });
  });
});
