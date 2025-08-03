import { describe, expect, it, jest, beforeEach, afterEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PinoLogger } from 'nestjs-pino';

describe('HealthService (Simplified)', () => {
  let service: HealthService;
  let supabaseService: SupabaseService;
  let logger: PinoLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is accessible', async () => {
      // Arrange
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: '123' }],
              error: null,
            }),
          }),
        }),
      };
      jest
        .spyOn(supabaseService, 'getClient')
        .mockReturnValue(mockClient as any);

      // Act
      const result = await service.checkDatabase('database');

      // Assert
      expect(result).toEqual({
        database: {
          status: 'up',
          responseTime: expect.any(Number),
        },
      });
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should throw HealthCheckError when database query fails', async () => {
      // Arrange
      const mockError = { message: 'Database connection failed' };
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      };
      jest
        .spyOn(supabaseService, 'getClient')
        .mockReturnValue(mockClient as any);

      // Act & Assert
      await expect(service.checkDatabase('database')).rejects.toThrow(
        HealthCheckError,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('checkSupabaseAuth', () => {
    it('should return healthy status when auth service is accessible', async () => {
      // Arrange
      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };
      jest
        .spyOn(supabaseService, 'getClient')
        .mockReturnValue(mockClient as any);

      // Act
      const result = await service.checkSupabaseAuth('supabase_auth');

      // Assert
      expect(result).toEqual({
        supabase_auth: {
          status: 'up',
          responseTime: expect.any(Number),
          sessionActive: false,
        },
      });
    });
  });

  describe('getApplicationMetrics', () => {
    it('should return metrics with correct structure', async () => {
      // Arrange
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockImplementation(() => ({
            gte: jest.fn().mockResolvedValue({ count: 5, error: null }),
            then: (callback: any) =>
              Promise.resolve(callback({ count: 10, error: null })),
          })),
        }),
      };
      jest
        .spyOn(supabaseService, 'getClient')
        .mockReturnValue(mockClient as any);

      // Act
      const metrics = await service.getApplicationMetrics();

      // Assert
      expect(metrics).toMatchObject({
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        memory: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
          external: expect.any(Number),
        },
        business: {
          totalBudgets: expect.any(Number),
          totalTransactions: expect.any(Number),
          totalUsers: expect.any(Number),
          recentActivity: {
            budgetsCreated24h: expect.any(Number),
            transactionsCreated24h: expect.any(Number),
            usersRegistered24h: expect.any(Number),
          },
        },
        errors: {
          rate5min: expect.any(Number),
          rate1hour: expect.any(Number),
          rate24hour: expect.any(Number),
        },
      });
    });
  });

  describe('trackError', () => {
    it('should track errors correctly', async () => {
      // Arrange & Act
      service.trackError();
      service.trackError();

      // Get metrics with mocked client
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockImplementation(() => ({
            then: (callback: any) =>
              Promise.resolve(callback({ count: 0, error: null })),
          })),
        }),
      };
      jest
        .spyOn(supabaseService, 'getClient')
        .mockReturnValue(mockClient as any);

      const metrics = await service.getApplicationMetrics();

      // Assert
      expect(metrics.errors.rate5min).toBeGreaterThanOrEqual(2);
    });
  });
});
