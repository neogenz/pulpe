import { Inject, type Provider } from '@nestjs/common';
import { getLoggerToken, type PinoLogger } from 'nestjs-pino';
import type { InfoLogger } from './info-logger.interface';

export const INFO_LOGGER_TOKEN = 'INFO_LOGGER';

export function createInfoLoggerProvider(
  context: string,
): Provider<InfoLogger> {
  return {
    provide: `${INFO_LOGGER_TOKEN}:${context}`,
    useFactory: (pinoLogger: PinoLogger): InfoLogger => ({
      info: pinoLogger.info.bind(pinoLogger),
      debug: pinoLogger.debug.bind(pinoLogger),
      warn: pinoLogger.warn.bind(pinoLogger),
      trace: pinoLogger.trace.bind(pinoLogger),
    }),
    inject: [getLoggerToken(context)],
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- NestJS decorator convention
export function InjectInfoLogger(context: string): ParameterDecorator {
  return Inject(`${INFO_LOGGER_TOKEN}:${context}`);
}
