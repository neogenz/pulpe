import {
  describe,
  it,
  expect,
  mock,
  beforeEach,
  afterEach,
  spyOn,
} from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedLoggerService, LogContext } from './enhanced-logger.service';
import { PinoLogger } from 'nestjs-pino';

describe('EnhancedLoggerService', () => {
  let service: EnhancedLoggerService;
  let mockPinoLogger: any;

  beforeEach(async () => {
    // Create mock PinoLogger
    mockPinoLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
      trace: mock(() => {}),
      fatal: mock(() => {}),
      setContext: mock(() => {}),
      assign: mock(() => {}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedLoggerService,
        {
          provide: `PinoLogger:${EnhancedLoggerService.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<EnhancedLoggerService>(EnhancedLoggerService);

    // Reset performance.now() for consistent tests
    spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    // Mock cleanup handled by bun:test
  });

  describe('startOperation', () => {
    it('should start an operation and return operationId', () => {
      const operation = 'test.operation';
      const context: LogContext = { userId: 'user123', entityId: 'entity456' };

      const operationId = service.startOperation(operation, context);

      expect(operationId).toBeDefined();
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation,
          operationId,
          userId: 'user123',
          entityId: 'entity456',
          event: 'operation_started',
        }),
        'Started operation: test.operation',
      );
    });

    it('should generate unique operation IDs', () => {
      const id1 = service.startOperation('op1');
      const id2 = service.startOperation('op2');

      expect(id1).not.toBe(id2);
    });
  });

  describe('completeOperation', () => {
    it('should complete an operation and log metrics', () => {
      spyOn(performance, 'now')
        .mockReturnValueOnce(0) // Start time
        .mockReturnValueOnce(150); // End time

      const operationId = service.startOperation('test.operation', {
        userId: 'user123',
      });
      service.completeOperation(operationId, { resultCount: 5 });

      expect(mockPinoLogger.info).toHaveBeenLastCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          userId: 'user123',
          resultCount: 5,
          duration: 150,
          durationMs: 150,
          event: 'operation_completed',
        }),
        'Completed operation: test.operation in 150ms',
      );
    });

    it('should warn for unknown operation completion', () => {
      service.completeOperation('unknown-id');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { operationId: 'unknown-id' },
        'Attempted to complete unknown operation',
      );
    });

    it('should use correct log level based on performance thresholds', () => {
      // Set custom threshold
      service.setPerformanceThreshold('slow.operation', {
        warn: 50,
        error: 100,
      });

      // Test warning threshold
      spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(75);

      const opId1 = service.startOperation('slow.operation');
      service.completeOperation(opId1);

      expect(mockPinoLogger.warn).toHaveBeenCalled();

      // Test error threshold
      spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(150);

      const opId2 = service.startOperation('slow.operation');
      service.completeOperation(opId2);

      expect(mockPinoLogger.error).toHaveBeenCalled();
    });
  });

  describe('failOperation', () => {
    it('should log operation failure with error context', () => {
      spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

      const operationId = service.startOperation('test.operation', {
        userId: 'user123',
      });
      const error = new Error('Test error');

      service.failOperation(operationId, error, { additionalInfo: 'extra' });

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          userId: 'user123',
          additionalInfo: 'extra',
          duration: 100,
          durationMs: 100,
          error: {
            message: 'Test error',
            name: 'Error',
            stack: expect.any(String),
          },
          event: 'operation_failed',
          err: error,
        }),
        'Failed operation: test.operation after 100ms',
      );
    });

    it('should handle unknown operation failure', () => {
      const error = new Error('Test error');
      service.failOperation('unknown-id', error);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'unknown-id',
          err: error,
        }),
        'Failed unknown operation',
      );
    });
  });

  describe('logCommand', () => {
    it('should log successful command execution', async () => {
      const result = { id: 123, name: 'test' };
      const execute = mock(() => Promise.resolve(result));

      const actualResult = await service.logCommand(
        'CreateUser',
        { userId: 'user123' },
        execute,
      );

      expect(actualResult).toBe(result);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(2); // start and complete
      expect(execute).toHaveBeenCalled();
    });

    it('should log failed command execution', async () => {
      const error = new Error('Command failed');
      const execute = mock(() => Promise.reject(error));

      await expect(
        service.logCommand('CreateUser', { userId: 'user123' }, execute),
      ).rejects.toThrow(error);

      expect(mockPinoLogger.error).toHaveBeenCalled();
    });
  });

  describe('logQuery', () => {
    it('should log successful query with result count', async () => {
      const results = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const execute = mock(() => Promise.resolve(results));

      const actualResults = await service.logQuery(
        'FindAllUsers',
        { userId: 'user123' },
        execute,
      );

      expect(actualResults).toBe(results);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          resultCount: 3,
          resultType: 'Array',
        }),
        expect.any(String),
      );
    });

    it('should handle single result queries', async () => {
      const result = { id: 1, name: 'test' };
      const execute = mock(() => Promise.resolve(result));

      await service.logQuery('FindUserById', {}, execute);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          resultCount: 1,
        }),
        expect.any(String),
      );
    });
  });

  describe('logWithContext', () => {
    it('should log with enriched context', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      service.logWithContext('info', 'Test message', {
        userId: 'user123',
        operation: 'test',
      });

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          operation: 'test',
          timestamp: expect.any(String),
          environment: 'test',
        }),
        'Test message',
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('setPerformanceThreshold', () => {
    it('should set custom performance thresholds', () => {
      service.setPerformanceThreshold('custom.operation', {
        warn: 200,
        error: 500,
      });

      spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(300);

      const operationId = service.startOperation('custom.operation');
      service.completeOperation(operationId);

      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });
  });

  describe('logAnalytics', () => {
    it('should log analytics events', () => {
      service.logAnalytics(
        'user_signup',
        { plan: 'premium', source: 'web' },
        { userId: 'user123' },
      );

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'user_signup',
          properties: { plan: 'premium', source: 'web' },
          type: 'analytics',
          userId: 'user123',
        }),
        'Analytics event: user_signup',
      );
    });
  });

  describe('logAudit', () => {
    it('should log audit trail', () => {
      service.logAudit(
        'budget_created',
        { budgetId: 'budget123', amount: 1000 },
        { userId: 'user123', requestId: 'req456' },
      );

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'budget_created',
          details: { budgetId: 'budget123', amount: 1000 },
          type: 'audit',
          userId: 'user123',
          requestId: 'req456',
        }),
        'Audit: budget_created',
      );
    });
  });

  describe('logSampled', () => {
    it('should log based on sample rate', () => {
      const mockRandom = spyOn(Math, 'random');

      // Should log
      mockRandom.mockReturnValue(0.3);
      service.logSampled(0.5, 'info', 'Sampled message', { test: true });
      expect(mockPinoLogger.info).toHaveBeenCalled();

      // Should not log
      mockPinoLogger.info.mockClear();
      mockRandom.mockReturnValue(0.7);
      service.logSampled(0.5, 'info', 'Sampled message', { test: true });
      expect(mockPinoLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('performance threshold matching', () => {
    it('should match operation prefixes for thresholds', () => {
      spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(150);

      const operationId = service.startOperation('db.users.findAll');
      service.completeOperation(operationId);

      // Should use db. threshold (warn: 100, error: 1000)
      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });

    it('should use default thresholds for unknown operations', () => {
      spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1500);

      const operationId = service.startOperation('unknown.operation');
      service.completeOperation(operationId);

      // Should use default threshold (warn: 1000, error: 5000)
      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });
  });
});
