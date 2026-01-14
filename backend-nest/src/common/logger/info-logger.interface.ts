import type { PinoLogger } from 'nestjs-pino';

/**
 * Logger restreint pour les services.
 * Exclut error() et fatal() - les erreurs doivent être throw BusinessException.
 *
 * @principle "Log or Throw, Never Both"
 */
export type InfoLogger = Pick<PinoLogger, 'info' | 'debug' | 'warn' | 'trace'>;

/**
 * Logger complet - UNIQUEMENT pour GlobalExceptionFilter et infrastructure.
 */
export type ErrorLogger = Pick<PinoLogger, 'error' | 'fatal'>;
