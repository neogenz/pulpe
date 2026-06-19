import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Log levels for the application
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const REDACTED_VALUE = '***';
const KEY_SEPARATOR_PATTERN = /[_-]/g;

const SENSITIVE_KEY_SUBSTRINGS = ['password', 'secret', 'token'] as const;
const SENSITIVE_KEY_SUFFIXES = [
  'apikey',
  'anonkey',
  'servicerolekey',
  'privatekey',
  'encryptionkey',
  'clientkey',
  'authkey',
  'masterkey',
  'signingkey',
] as const;
const SENSITIVE_EXACT_KEYS = new Set(['key', 'userid', 'user_id', 'sub']);

function normalizeLogKey(key: string): string {
  return key.toLowerCase().replace(KEY_SEPARATOR_PATTERN, '');
}

function isSensitiveLogKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  const normalizedKey = normalizeLogKey(key);

  return (
    SENSITIVE_KEY_SUBSTRINGS.some((substring) =>
      lowerKey.includes(substring),
    ) ||
    SENSITIVE_KEY_SUFFIXES.some((suffix) => normalizedKey.endsWith(suffix)) ||
    SENSITIVE_EXACT_KEYS.has(lowerKey)
  );
}

/**
 * Centralized logging service for the application.
 * Provides environment-aware logging with automatic suppression in production.
 * Sanitizes sensitive data before logging.
 * Optionally forwards critical errors to PostHog for production monitoring.
 *
 * Following Angular 20 naming convention (no .service suffix)
 */
@Injectable({
  providedIn: 'root',
})
export class Logger {
  readonly #isProduction = environment.production;
  readonly #logLevel = this.#isProduction ? LogLevel.ERROR : LogLevel.DEBUG;

  /**
   * Debug level logging (suppressed in production)
   */
  debug(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.DEBUG && !this.#isProduction) {
      const [formattedMessage, sanitized] = this.#format(
        'DEBUG',
        message,
        data,
      );
      if (sanitized !== undefined) {
        console.debug(formattedMessage, sanitized);
      } else {
        console.debug(formattedMessage);
      }
    }
  }

  /**
   * Info level logging (suppressed in production)
   */
  info(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.INFO && !this.#isProduction) {
      const [formattedMessage, sanitized] = this.#format('INFO', message, data);
      if (sanitized !== undefined) {
        console.info(formattedMessage, sanitized);
      } else {
        console.info(formattedMessage);
      }
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.WARN) {
      const [formattedMessage, sanitized] = this.#format('WARN', message, data);
      if (sanitized !== undefined) {
        console.warn(formattedMessage, sanitized);
      } else {
        console.warn(formattedMessage);
      }
    }
  }

  /**
   * Error level logging
   * PostHog integration handled by GlobalErrorHandler
   */
  error(message: string, error?: unknown): void {
    if (this.#logLevel <= LogLevel.ERROR) {
      const [formattedMessage, sanitized] = this.#format(
        'ERROR',
        message,
        error,
      );
      if (sanitized !== undefined) {
        console.error(formattedMessage, sanitized);
      } else {
        console.error(formattedMessage);
      }
    }
  }

  /**
   * Sanitizes sensitive data from strings before logging
   */
  #sanitize(data: unknown): unknown {
    if (typeof data === 'string') {
      // Mask JWT tokens
      let sanitized = data.replace(
        /Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/gi,
        'Bearer ***',
      );

      // Mask Supabase anon keys (they start with 'eyJ')
      sanitized = sanitized.replace(
        /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/gi,
        '***MASKED_KEY***',
      );

      // Mask service role keys
      sanitized = sanitized.replace(
        /service_role_key[:=]["']?[A-Za-z0-9-_]+/gi,
        'service_role_key=***',
      );

      return sanitized;
    }

    if (typeof data === 'object' && data !== null) {
      // Deep clone and sanitize objects
      const sanitized: Record<string, unknown> | unknown[] = Array.isArray(data)
        ? []
        : {};

      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (isSensitiveLogKey(key)) {
            (sanitized as Record<string, unknown>)[key] = REDACTED_VALUE;
          } else {
            (sanitized as Record<string, unknown>)[key] = this.#sanitize(
              (data as Record<string, unknown>)[key],
            );
          }
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Formats the log message with context
   */
  #format(level: string, message: string, data?: unknown): [string, unknown?] {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    if (data === undefined) {
      return [formattedMessage];
    }

    return [formattedMessage, this.#sanitize(data)];
  }
}
