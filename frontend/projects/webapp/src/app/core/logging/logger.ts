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
          const lowerKey = key.toLowerCase();

          // Mask sensitive keys
          if (
            lowerKey.includes('password') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('token') ||
            lowerKey.includes('key') ||
            lowerKey.includes('anonkey')
          ) {
            (sanitized as Record<string, unknown>)[key] = '***';
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
