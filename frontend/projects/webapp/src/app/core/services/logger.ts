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
  #format(level: string, message: string, data?: unknown): unknown[] {
    const timestamp = new Date().toISOString();
    const prefix = this.#isProduction
      ? `[${level}]`
      : `[${timestamp}] [${level}]`;

    const result: unknown[] = [`${prefix} ${message}`];

    if (data !== undefined) {
      result.push(this.#sanitize(data));
    }

    return result;
  }

  /**
   * Debug level logging (suppressed in production)
   */
  debug(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.DEBUG && !this.#isProduction) {
      console.debug(...this.#format('DEBUG', message, data));
    }
  }

  /**
   * Info level logging (suppressed in production)
   */
  info(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.INFO && !this.#isProduction) {
      console.info(...this.#format('INFO', message, data));
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    if (this.#logLevel <= LogLevel.WARN) {
      const formatted = this.#format('WARN', message, data);

      if (this.#isProduction) {
        // In production, only log the message without data
        console.warn(formatted[0]);
      } else {
        console.warn(...formatted);
      }
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown): void {
    if (this.#logLevel <= LogLevel.ERROR) {
      const formatted = this.#format('ERROR', message, error);

      if (this.#isProduction) {
        // In production, log minimal error info
        console.error(formatted[0]);

        // Only log error stack in production if it's an actual Error object
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', this.#sanitize(error.stack));
        }
      } else {
        console.error(...formatted);
      }
    }
  }
}
