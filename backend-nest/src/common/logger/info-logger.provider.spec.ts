import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { PinoLogger } from 'nestjs-pino';
import type { FactoryProvider } from '@nestjs/common';
import {
  createInfoLoggerProvider,
  INFO_LOGGER_TOKEN,
} from './info-logger.provider';
import type { InfoLogger } from './info-logger.interface';

function createMockPinoLogger(): PinoLogger {
  return {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
    trace: mock(() => {}),
    fatal: mock(() => {}),
    setContext: mock(() => {}),
  } as unknown as PinoLogger;
}

describe('InfoLogger Provider', () => {
  let mockPinoLogger: PinoLogger;

  beforeEach(() => {
    mockPinoLogger = createMockPinoLogger();
  });

  describe('createInfoLoggerProvider', () => {
    it('should create provider with correct token', () => {
      const provider = createInfoLoggerProvider(
        'TestService',
      ) as FactoryProvider<InfoLogger>;

      expect(provider.provide).toBe(`${INFO_LOGGER_TOKEN}:TestService`);
    });

    it('should inject PinoLogger and set context', () => {
      const provider = createInfoLoggerProvider(
        'TestService',
      ) as FactoryProvider<InfoLogger>;

      expect(provider.inject).toContain(PinoLogger);

      const infoLogger = provider.useFactory(mockPinoLogger);
      expect(mockPinoLogger.setContext).toHaveBeenCalledWith('TestService');
      expect(infoLogger).toBeDefined();
    });

    it('should create InfoLogger with only info, debug, warn, trace methods', () => {
      const provider = createInfoLoggerProvider('TestService');
      const infoLogger = (
        provider as { useFactory: (logger: PinoLogger) => InfoLogger }
      ).useFactory(mockPinoLogger);

      expect(infoLogger.info).toBeDefined();
      expect(infoLogger.debug).toBeDefined();
      expect(infoLogger.warn).toBeDefined();
      expect(infoLogger.trace).toBeDefined();

      // TypeScript enforcement: error and fatal should NOT exist
      expect((infoLogger as Record<string, unknown>).error).toBeUndefined();
      expect((infoLogger as Record<string, unknown>).fatal).toBeUndefined();
    });

    it('should bind methods to original logger context', () => {
      const provider = createInfoLoggerProvider('TestService');
      const infoLogger = (
        provider as { useFactory: (logger: PinoLogger) => InfoLogger }
      ).useFactory(mockPinoLogger);

      infoLogger.info({ test: true }, 'Test message');

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { test: true },
        'Test message',
      );
    });

    it('should preserve context when calling each method', () => {
      const provider = createInfoLoggerProvider('TestService');
      const infoLogger = (
        provider as { useFactory: (logger: PinoLogger) => InfoLogger }
      ).useFactory(mockPinoLogger);

      infoLogger.debug({ operation: 'test' }, 'Debug message');
      infoLogger.warn({ userId: '123' }, 'Warning message');
      infoLogger.trace({ detail: 'x' }, 'Trace message');

      expect(mockPinoLogger.debug).toHaveBeenCalledWith(
        { operation: 'test' },
        'Debug message',
      );
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { userId: '123' },
        'Warning message',
      );
      expect(mockPinoLogger.trace).toHaveBeenCalledWith(
        { detail: 'x' },
        'Trace message',
      );
    });
  });
});
