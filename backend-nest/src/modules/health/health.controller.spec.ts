import { describe, expect, it, jest, beforeEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MonitoringService } from './monitoring.service';
import { PinoLogger } from 'nestjs-pino';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let healthService: HealthService;
  let monitoringService: MonitoringService;
  let logger: PinoLogger;

  const mockHealthCheckResult = {
    status: 'ok',
    info: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
      memory_rss: { status: 'up' },
      storage: { status: 'up' },
    },
    error: {},
    details: {},
  };

  const mockApplicationMetrics = {
    uptime: 3600,
    timestamp: '2024-01-01T00:00:00.000Z',
    memory: {
      heapUsed: 50000000,
      heapTotal: 100000000,
      rss: 150000000,
      external: 5000000,
    },
    business: {
      totalBudgets: 100,
      totalTransactions: 500,
      totalUsers: 50,
      recentActivity: {
        budgetsCreated24h: 10,
        transactionsCreated24h: 50,
        usersRegistered24h: 5,
      },
    },
    errors: {
      rate5min: 0,
      rate1hour: 2,
      rate24hour: 10,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue(mockHealthCheckResult),
          },
        },
        {
          provide: DiskHealthIndicator,
          useValue: {
            checkStorage: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
        {
          provide: HealthService,
          useValue: {
            checkDatabase: jest
              .fn()
              .mockResolvedValue({ database: { status: 'up' } }),
            checkSupabaseAuth: jest
              .fn()
              .mockResolvedValue({ supabase_auth: { status: 'up' } }),
            getApplicationMetrics: jest
              .fn()
              .mockResolvedValue(mockApplicationMetrics),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            getOperationStats: jest.fn().mockReturnValue({
              count: 100,
              successCount: 95,
              errorCount: 5,
              avgDuration: 150,
              minDuration: 10,
              maxDuration: 1000,
              p50Duration: 100,
              p95Duration: 500,
              p99Duration: 900,
            }),
            getAllOperationStats: jest.fn().mockReturnValue({
              operation1: { count: 50, avgDuration: 100 },
              operation2: { count: 50, avgDuration: 200 },
            }),
            getSystemOverview: jest.fn().mockReturnValue({
              timestamp: '2024-01-01T00:00:00.000Z',
              recentActivity: {
                operations: 100,
                errors: 5,
                successRate: 95,
              },
              hourlyActivity: {
                operations: 1000,
                errors: 50,
                successRate: 95,
              },
              topOperations: [{ operation: 'test', count: 100 }],
              slowestOperations: [{ operation: 'slow', avgDuration: 1000 }],
            }),
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

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    healthService = module.get<HealthService>(HealthService);
    monitoringService = module.get<MonitoringService>(MonitoringService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  describe('check', () => {
    it('should return health check status', async () => {
      // Act
      const result = await controller.check();

      // Assert
      expect(result).toEqual(mockHealthCheckResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'health_check',
          duration: expect.any(Number),
          status: 'ok',
        }),
        'Health check completed',
      );
    });

    it('should log error when health check fails', async () => {
      // Arrange
      const error = new Error('Health check failed');
      jest.spyOn(healthCheckService, 'check').mockRejectedValueOnce(error);

      // Act & Assert
      await expect(controller.check()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'health_check',
          duration: expect.any(Number),
          err: error,
        }),
        'Health check failed',
      );
    });
  });

  describe('checkLiveness', () => {
    it('should return liveness status', async () => {
      // Act
      const result = await controller.checkLiveness();

      // Assert
      expect(result).toEqual(mockHealthCheckResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // memory check only
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'liveness_check',
          duration: expect.any(Number),
          status: 'ok',
        }),
        'Liveness check completed',
      );
    });
  });

  describe('checkReadiness', () => {
    it('should return readiness status', async () => {
      // Act
      const result = await controller.checkReadiness();

      // Assert
      expect(result).toEqual(mockHealthCheckResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // auth check
        expect.any(Function), // memory check
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'readiness_check',
          duration: expect.any(Number),
          status: 'ok',
        }),
        'Readiness check completed',
      );
    });
  });

  describe('getMetrics', () => {
    it('should return application metrics', async () => {
      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(result).toEqual(mockApplicationMetrics);
      expect(healthService.getApplicationMetrics).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_metrics',
          duration: expect.any(Number),
        }),
        'Metrics retrieved successfully',
      );
    });

    it('should log error when metrics retrieval fails', async () => {
      // Arrange
      const error = new Error('Metrics retrieval failed');
      jest
        .spyOn(healthService, 'getApplicationMetrics')
        .mockRejectedValueOnce(error);

      // Act & Assert
      await expect(controller.getMetrics()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_metrics',
          duration: expect.any(Number),
          err: error,
        }),
        'Failed to retrieve metrics',
      );
    });
  });

  describe('getOperationStats', () => {
    it('should return stats for specific operation', async () => {
      // Act
      const result = await controller.getOperationStats(
        'test_operation',
        '60000',
      );

      // Assert
      expect(result).toHaveProperty('test_operation');
      expect(monitoringService.getOperationStats).toHaveBeenCalledWith(
        'test_operation',
        60000,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_operation_stats',
          duration: expect.any(Number),
          statsCount: 1,
        }),
        'Operation stats retrieved successfully',
      );
    });

    it('should return all operation stats when no operation specified', async () => {
      // Act
      const result = await controller.getOperationStats(undefined, undefined);

      // Assert
      expect(result).toHaveProperty('operation1');
      expect(result).toHaveProperty('operation2');
      expect(monitoringService.getAllOperationStats).toHaveBeenCalledWith(
        3600000,
      );
    });

    it('should use default time range when not specified', async () => {
      // Act
      await controller.getOperationStats('test', undefined);

      // Assert
      expect(monitoringService.getOperationStats).toHaveBeenCalledWith(
        'test',
        3600000,
      );
    });
  });

  describe('getSystemOverview', () => {
    it('should return system overview', async () => {
      // Act
      const result = await controller.getSystemOverview();

      // Assert
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recentActivity');
      expect(result).toHaveProperty('hourlyActivity');
      expect(result).toHaveProperty('topOperations');
      expect(result).toHaveProperty('slowestOperations');
      expect(monitoringService.getSystemOverview).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_system_overview',
          duration: expect.any(Number),
        }),
        'System overview retrieved successfully',
      );
    });

    it('should log error when system overview fails', async () => {
      // Arrange
      const error = new Error('Overview retrieval failed');
      jest
        .spyOn(monitoringService, 'getSystemOverview')
        .mockImplementationOnce(() => {
          throw error;
        });

      // Act & Assert
      await expect(controller.getSystemOverview()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_system_overview',
          duration: expect.any(Number),
          err: error,
        }),
        'Failed to retrieve system overview',
      );
    });
  });
});
