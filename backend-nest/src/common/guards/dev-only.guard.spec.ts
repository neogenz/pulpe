import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevOnlyGuard } from './dev-only.guard';

interface MockConfigService {
  get: (key: string, defaultValue?: string) => string | undefined;
}

interface MockPinoLogger {
  error: () => void;
  warn: (
    meta: { nodeEnv: string; path: string; method: string },
    message: string,
  ) => void;
  info: () => void;
  debug: () => void;
  trace: () => void;
  fatal: () => void;
}

describe('DevOnlyGuard', () => {
  let guard: DevOnlyGuard;
  let mockConfigService: MockConfigService;

  const mockPinoLogger: MockPinoLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
  };

  beforeEach(async () => {
    mockConfigService = {
      get: (key: string, defaultValue?: string) => defaultValue,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevOnlyGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: `PinoLogger:${DevOnlyGuard.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    guard = module.get<DevOnlyGuard>(DevOnlyGuard);
  });

  const createMockContext = (
    url = '/api/v1/demo/cleanup',
    method = 'POST',
  ): ExecutionContext => {
    const mockRequest = { url, method };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access in development mode', () => {
      mockConfigService.get = () => 'development';
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access in test mode', () => {
      mockConfigService.get = () => 'test';
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when NODE_ENV is undefined (defaults to development)', () => {
      mockConfigService.get = (key: string, defaultValue?: string) =>
        defaultValue;
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException in production mode', () => {
      mockConfigService.get = () => 'production';
      const context = createMockContext();

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException in preview mode', () => {
      mockConfigService.get = () => 'preview';
      const context = createMockContext();

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should log warning when production access is attempted', () => {
      mockConfigService.get = () => 'production';
      const context = createMockContext('/api/v1/demo/cleanup', 'POST');

      let loggedWarning = false;
      mockPinoLogger.warn = (
        meta: { nodeEnv: string; path: string; method: string },
        message: string,
      ) => {
        loggedWarning = true;
        expect(meta.nodeEnv).toBe('production');
        expect(meta.path).toBe('/api/v1/demo/cleanup');
        expect(meta.method).toBe('POST');
        expect(message).toContain('Development-only endpoint');
      };

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
      }

      expect(loggedWarning).toBe(true);
    });
  });
});
