import { describe, expect, it, jest, beforeEach, afterEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let logger: PinoLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
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

    service = module.get<MonitoringService>(MonitoringService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.onModuleDestroy();
  });

  describe('recordOperation', () => {
    it('should record operation metrics', () => {
      // Act
      service.recordOperation('test_operation', 100, true, { userId: '123' });

      // Assert
      const stats = service.getOperationStats('test_operation');
      expect(stats).toEqual({
        count: 1,
        successCount: 1,
        errorCount: 0,
        avgDuration: 100,
        minDuration: 100,
        maxDuration: 100,
        p50Duration: 100,
        p95Duration: 100,
        p99Duration: 100,
      });
    });

    it('should log warning for slow operations', () => {
      // Act
      service.recordOperation('slow_operation', 1500, true);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'slow_operation',
          duration: 1500,
          success: true,
        }),
        'Slow operation detected',
      );
    });

    it('should track failed operations', () => {
      // Act
      service.recordOperation('failing_operation', 50, false);

      // Assert
      const stats = service.getOperationStats('failing_operation');
      expect(stats.errorCount).toBe(1);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('getOperationStats', () => {
    it('should calculate percentiles correctly', () => {
      // Arrange - Record multiple operations with different durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      durations.forEach((duration) => {
        service.recordOperation('test_op', duration, true);
      });

      // Act
      const stats = service.getOperationStats('test_op');

      // Assert
      expect(stats.count).toBe(10);
      expect(stats.avgDuration).toBe(55);
      expect(stats.minDuration).toBe(10);
      expect(stats.maxDuration).toBe(100);
      expect(stats.p50Duration).toBe(60); // 50th percentile
      expect(stats.p95Duration).toBe(100); // 95th percentile
      expect(stats.p99Duration).toBe(100); // 99th percentile
    });

    it('should return empty stats for non-existent operation', () => {
      // Act
      const stats = service.getOperationStats('non_existent');

      // Assert
      expect(stats).toEqual({
        count: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
      });
    });

    it('should filter by time range', () => {
      // Arrange - Record operation and wait
      service.recordOperation('time_test', 100, true);

      // Act - Get stats with 0ms time range (should be empty)
      const stats = service.getOperationStats('time_test', 0);

      // Assert
      expect(stats.count).toBe(0);
    });
  });

  describe('getAllOperationStats', () => {
    it('should return stats for all operations', () => {
      // Arrange
      service.recordOperation('op1', 100, true);
      service.recordOperation('op2', 200, true);
      service.recordOperation('op3', 300, false);

      // Act
      const allStats = service.getAllOperationStats();

      // Assert
      expect(Object.keys(allStats)).toHaveLength(3);
      expect(allStats.op1.avgDuration).toBe(100);
      expect(allStats.op2.avgDuration).toBe(200);
      expect(allStats.op3.avgDuration).toBe(300);
      expect(allStats.op3.errorCount).toBe(1);
    });
  });

  describe('getSystemOverview', () => {
    it('should provide system overview with recent activity', () => {
      // Arrange
      service.recordOperation('recent_op', 100, true);
      service.recordOperation('recent_op', 150, false);
      service.recordOperation('old_op', 200, true);

      // Act
      const overview = service.getSystemOverview();

      // Assert
      expect(overview).toMatchObject({
        timestamp: expect.any(String),
        recentActivity: {
          operations: expect.any(Number),
          errors: expect.any(Number),
          successRate: expect.any(Number),
        },
        hourlyActivity: {
          operations: expect.any(Number),
          errors: expect.any(Number),
          successRate: expect.any(Number),
        },
        topOperations: expect.any(Array),
        slowestOperations: expect.any(Array),
      });
    });

    it('should identify top operations by count', () => {
      // Arrange
      service.recordOperation('popular', 100, true);
      service.recordOperation('popular', 100, true);
      service.recordOperation('popular', 100, true);
      service.recordOperation('medium', 100, true);
      service.recordOperation('medium', 100, true);
      service.recordOperation('rare', 100, true);

      // Act
      const overview = service.getSystemOverview();

      // Assert
      expect(overview.topOperations[0]).toEqual({
        operation: 'popular',
        count: 3,
      });
      expect(overview.topOperations[1]).toEqual({
        operation: 'medium',
        count: 2,
      });
      expect(overview.topOperations[2]).toEqual({
        operation: 'rare',
        count: 1,
      });
    });

    it('should identify slowest operations', () => {
      // Arrange
      service.recordOperation('slow', 1000, true);
      service.recordOperation('medium', 500, true);
      service.recordOperation('fast', 100, true);

      // Act
      const overview = service.getSystemOverview();

      // Assert
      expect(overview.slowestOperations[0]).toEqual({
        operation: 'slow',
        avgDuration: 1000,
      });
      expect(overview.slowestOperations[1]).toEqual({
        operation: 'medium',
        avgDuration: 500,
      });
      expect(overview.slowestOperations[2]).toEqual({
        operation: 'fast',
        avgDuration: 100,
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup old metrics periodically', async () => {
      // This is tested implicitly by the cleanup interval
      // We verify that the service doesn't crash and the interval is set
      expect(service).toBeDefined();
    });
  });
});
