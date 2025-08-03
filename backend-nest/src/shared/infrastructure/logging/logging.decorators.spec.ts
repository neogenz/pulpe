import 'reflect-metadata';
import {
  LogOperation,
  LogPerformance,
  LogErrors,
  LogAudit,
  LogParam,
} from './logging.decorators';
import { EnhancedLoggerService } from './enhanced-logger.service';

describe('Logging Decorators', () => {
  let mockLogger: jest.Mocked<EnhancedLoggerService>;

  beforeEach(() => {
    mockLogger = {
      startOperation: jest.fn().mockReturnValue('operation-123'),
      completeOperation: jest.fn(),
      failOperation: jest.fn(),
      logWithContext: jest.fn(),
      setPerformanceThreshold: jest.fn(),
      logAudit: jest.fn(),
      logCommand: jest.fn(),
      logQuery: jest.fn(),
      logAnalytics: jest.fn(),
      logSampled: jest.fn(),
      createChildLogger: jest.fn(),
    } as unknown as jest.Mocked<EnhancedLoggerService>;

    jest.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('@LogOperation', () => {
    class TestService {
      enhancedLogger = mockLogger;

      @LogOperation()
      async simpleMethod() {
        return { result: 'success' };
      }

      @LogOperation('custom.operation')
      async customOperation(userId: string, data: any) {
        return { id: 123 };
      }

      @LogOperation()
      async methodWithError() {
        throw new Error('Test error');
      }
    }

    it('should log successful operation execution', async () => {
      const service = new TestService();
      const result = await service.simpleMethod();

      expect(result).toEqual({ result: 'success' });
      expect(mockLogger.startOperation).toHaveBeenCalledWith(
        'TestService.simpleMethod',
        expect.objectContaining({
          method: 'simpleMethod',
          className: 'TestService',
        }),
      );
      expect(mockLogger.completeOperation).toHaveBeenCalledWith(
        'operation-123',
        expect.objectContaining({
          success: true,
          resultType: 'Object',
        }),
      );
    });

    it('should use custom operation name when provided', async () => {
      const service = new TestService();
      await service.customOperation('user123', { test: true });

      expect(mockLogger.startOperation).toHaveBeenCalledWith(
        'custom.operation',
        expect.any(Object),
      );
    });

    it('should log operation failure', async () => {
      const service = new TestService();

      await expect(service.methodWithError()).rejects.toThrow('Test error');

      expect(mockLogger.failOperation).toHaveBeenCalledWith(
        'operation-123',
        expect.objectContaining({ message: 'Test error' }),
      );
    });

    it('should extract context from method arguments', async () => {
      const service = new TestService();
      await service.customOperation('user123', { id: '456' });

      expect(mockLogger.startOperation).toHaveBeenCalledWith(
        'custom.operation',
        expect.objectContaining({
          entityId: 'user123', // First argument is string, used as entityId
          method: 'customOperation',
          className: 'TestService',
        }),
      );
    });

    it('should handle missing logger gracefully', async () => {
      class ServiceWithoutLogger {
        @LogOperation()
        async method() {
          return 'result';
        }
      }

      const service = new ServiceWithoutLogger();
      const result = await service.method();

      expect(result).toBe('result');
      expect(mockLogger.startOperation).not.toHaveBeenCalled();
    });
  });

  describe('@LogPerformance', () => {
    class TestService {
      enhancedLogger = mockLogger;

      @LogPerformance({ warnThreshold: 100, errorThreshold: 500 })
      async slowMethod() {
        return 'done';
      }

      @LogPerformance({ sampleRate: 0.5 })
      async sampledMethod() {
        return 'sampled';
      }
    }

    it('should set performance thresholds and log warnings', async () => {
      jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(150); // 150ms duration

      const service = new TestService();
      await service.slowMethod();

      expect(mockLogger.setPerformanceThreshold).toHaveBeenCalledWith(
        'TestService.slowMethod',
        { warn: 100, error: 500 },
      );
      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Performance warning'),
        expect.objectContaining({
          duration: 150,
          threshold: 100,
        }),
      );
    });

    it('should log error for critical performance', async () => {
      jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(600); // 600ms duration

      const service = new TestService();
      await service.slowMethod();

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Performance critical'),
        expect.objectContaining({
          duration: 600,
          threshold: 500,
        }),
      );
    });

    it('should respect sample rate', async () => {
      const mockRandom = jest.spyOn(Math, 'random');
      const service = new TestService();

      // Should not log
      mockRandom.mockReturnValue(0.7);
      await service.sampledMethod();
      expect(mockLogger.setPerformanceThreshold).not.toHaveBeenCalled();

      // Should log
      mockRandom.mockReturnValue(0.3);
      await service.sampledMethod();
      expect(mockLogger.setPerformanceThreshold).toHaveBeenCalled();
    });
  });

  describe('@LogErrors', () => {
    class TestService {
      enhancedLogger = mockLogger;

      @LogErrors()
      async methodWithError() {
        throw new Error('Test error');
      }

      @LogErrors({ includeStack: false })
      async methodWithoutStack() {
        throw new Error('No stack error');
      }

      @LogErrors({ sensitiveParams: [1] })
      async methodWithSensitiveData(publicData: string, sensitiveData: string) {
        throw new Error('Sensitive error');
      }
    }

    it('should log errors with context', async () => {
      const service = new TestService();

      await expect(service.methodWithError()).rejects.toThrow('Test error');

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Error in TestService.methodWithError'),
        expect.objectContaining({
          method: 'methodWithError',
          className: 'TestService',
          errorName: 'Error',
          errorMessage: 'Test error',
          stack: expect.any(String),
        }),
      );
    });

    it('should exclude stack when configured', async () => {
      const service = new TestService();

      await expect(service.methodWithoutStack()).rejects.toThrow();

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.any(String),
        expect.not.objectContaining({ stack: expect.any(String) }),
      );
    });

    it('should redact sensitive parameters', async () => {
      const service = new TestService();

      await expect(
        service.methodWithSensitiveData('public', 'secret'),
      ).rejects.toThrow();

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.any(String),
        expect.objectContaining({
          args: ['public', '[REDACTED]'],
        }),
      );
    });
  });

  describe('@LogAudit', () => {
    class TestService {
      enhancedLogger = mockLogger;

      @LogAudit({ action: 'create_budget', resourceType: 'budget' })
      async createBudget(data: any) {
        return { id: 'budget123', ...data };
      }

      @LogAudit({ action: 'delete_budget', includeResult: true })
      async deleteBudget(id: string) {
        return { id, deleted: true };
      }

      @LogAudit({ action: 'update_budget' })
      async updateWithError(id: string) {
        throw new Error('Update failed');
      }
    }

    it('should log audit trail for successful operations', async () => {
      mockLogger.logAudit.mockImplementation(async () => {});

      const service = new TestService();
      const result = await service.createBudget({ amount: 1000 });

      expect(result.id).toBe('budget123');
      expect(mockLogger.logAudit).toHaveBeenCalledWith(
        'create_budget',
        expect.objectContaining({
          timestamp: expect.any(String),
          action: 'create_budget',
          method: 'createBudget',
        }),
        expect.objectContaining({
          resourceType: 'budget',
        }),
      );
    });

    it('should include result when configured', async () => {
      mockLogger.logAudit.mockImplementation(async () => {});

      const service = new TestService();
      await service.deleteBudget('budget123');

      expect(mockLogger.logAudit).toHaveBeenCalledWith(
        'delete_budget',
        expect.objectContaining({
          resultId: 'budget123',
          resultType: 'Object',
        }),
        expect.any(Object),
      );
    });

    it('should log audit trail for failed operations', async () => {
      mockLogger.logAudit.mockImplementation(async () => {});

      const service = new TestService();

      await expect(service.updateWithError('budget123')).rejects.toThrow();

      expect(mockLogger.logAudit).toHaveBeenCalledWith(
        'update_budget_failed',
        expect.objectContaining({
          error: 'Update failed',
          success: false,
        }),
        expect.any(Object),
      );
    });
  });

  describe('@LogParam', () => {
    it('should store parameter metadata', () => {
      class TestService {
        method(
          @LogParam('userId') userId: string,
          @LogParam('data')
          data: any,
        ) {
          return { userId, data };
        }
      }

      const metadata = Reflect.getMetadata(
        'log:params',
        TestService.prototype,
        'method',
      );

      // Parameter decorators are applied in reverse order
      expect(metadata).toContainEqual({ index: 0, name: 'userId' });
      expect(metadata).toContainEqual({ index: 1, name: 'data' });
      expect(metadata).toHaveLength(2);
    });
  });
});
