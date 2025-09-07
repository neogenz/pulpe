import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { ApplicationConfiguration } from '../config/application-configuration';

/**
 * Type representing all possible error candidates
 */
type ErrorCandidate =
  | Error
  | HttpErrorResponse
  | string
  | ErrorEvent
  | null
  | undefined;

/**
 * Error context information
 */
interface ErrorContext {
  readonly timestamp: string;
  readonly userAgent: string;
  readonly url: string;
  readonly route: string;
  readonly environment: string;
  readonly errorType: string;
  readonly isHttpError: boolean;
  readonly stackTrace?: string;
  readonly httpStatus?: number;
  readonly httpStatusText?: string;
  readonly httpUrl?: string | null;
  readonly httpMethod?: string;
}

/**
 * Error severity levels
 */
type ErrorLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Type guard for HttpErrorResponse
 */
function isHttpErrorResponse(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse;
}

/**
 * Type guard for Error objects
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Global error handler that integrates with PostHog for comprehensive error tracking.
 * Extends Angular's default error handler to capture and report all unhandled errors.
 *
 * Features:
 * - PostHog integration for error tracking in production
 * - Comprehensive error extraction and context gathering
 * - Security-aware data sanitization
 * - Environment-aware logging and reporting
 */
@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #router = inject(Router);

  // Simple error tracking with signal
  readonly #errorCount = signal(0);

  /**
   * Handle errors from Angular's error handling system
   */
  handleError(error: ErrorCandidate): void {
    try {
      // Update error count
      this.#errorCount.update((count) => count + 1);

      // Extract and log error information
      const extractedError = this.#extractError(error);
      const errorContext = this.#gatherErrorContext(error, extractedError);

      // Always log to console in development or if PostHog is not available
      if (
        this.#applicationConfiguration.isDevelopment() ||
        !this.#postHogService.isInitialized()
      ) {
        console.error('Global error caught:', extractedError);
        console.error('Error context:', errorContext);
      }

      // Log using our centralized logger
      this.#logger.error('Global error handler caught error', {
        error: extractedError,
        context: errorContext,
      });

      // Send to PostHog if initialized and enabled
      if (
        this.#postHogService.isInitialized() &&
        this.#postHogService.isEnabled()
      ) {
        this.#reportToPostHog(extractedError, errorContext);
      }
    } catch (handlingError) {
      // Prevent infinite error loops
      console.error('Error in error handler:', handlingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Extract meaningful error information from the error object
   */
  #extractError(errorCandidate: ErrorCandidate): ErrorCandidate {
    const error = this.#tryToUnwrapZoneJsError(errorCandidate);

    // Handle HTTP errors specifically
    if (isHttpErrorResponse(error)) {
      return this.#extractHttpModuleError(error);
    }

    // Handle standard errors and error-like objects
    if (typeof error === 'string' || this.#isErrorOrErrorLikeObject(error)) {
      return error;
    }

    // Fallback for unknown error types
    return error ?? 'Unknown error occurred';
  }

  /**
   * Gather contextual information about the error
   */
  #gatherErrorContext(
    originalError: ErrorCandidate,
    extractedError: ErrorCandidate,
  ): ErrorContext {
    const baseContext: ErrorContext = {
      // Timing information
      timestamp: new Date().toISOString(),

      // Browser context
      userAgent: navigator.userAgent,
      url: window.location.href,
      route: this.#getCurrentRoute(),

      // Application context
      environment: this.#applicationConfiguration.environment(),

      // Error classification
      errorType: this.#classifyError(originalError),
      isHttpError: isHttpErrorResponse(originalError),

      // Stack trace (if available)
      stackTrace: this.#extractStackTrace(extractedError),
    };

    // Add HTTP-specific context if applicable
    if (isHttpErrorResponse(originalError)) {
      return {
        ...baseContext,
        httpStatus: originalError.status,
        httpStatusText: originalError.statusText,
        httpUrl: originalError.url,
        httpMethod: 'Unknown', // Would need to be passed from interceptor
      };
    }

    return baseContext;
  }

  /**
   * Report error to PostHog with proper context
   */
  #reportToPostHog(error: ErrorCandidate, context: ErrorContext): void {
    runOutsideAngular(() => {
      this.#postHogService.captureException(error, {
        ...context,
        // Add PostHog-specific metadata
        error_boundary: 'global_error_handler',
        error_level: this.#determineErrorLevel(error),
      });
    });
  }

  /**
   * Unwrap Zone.js error wrapping
   */
  #tryToUnwrapZoneJsError(error: ErrorCandidate): ErrorCandidate {
    // Handle Zone.js error wrapping (common in Angular applications)
    if (error && typeof error === 'object' && 'ngOriginalError' in error) {
      return (error as { ngOriginalError: Error }).ngOriginalError;
    }
    return error;
  }

  /**
   * Extract meaningful information from HTTP errors
   */
  #extractHttpModuleError(error: HttpErrorResponse): string | Error {
    // The error property can be an Error object
    if (this.#isErrorOrErrorLikeObject(error.error)) {
      return error.error;
    }

    // Or an ErrorEvent with a message
    if (
      typeof ErrorEvent !== 'undefined' &&
      error.error instanceof ErrorEvent &&
      error.error.message
    ) {
      return error.error.message;
    }

    // Or the request body itself as a string
    if (typeof error.error === 'string') {
      return `Server returned code ${error.status} with body "${error.error}"`;
    }

    // Fallback to the error message
    return error.message;
  }

  /**
   * Check if value is an Error or error-like object
   */
  #isErrorOrErrorLikeObject(value: ErrorCandidate): value is Error {
    if (value instanceof Error) {
      return true;
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    // Check for error-like structure (safely handle objects that may not have string index signatures)
    return (
      'name' in value &&
      typeof value.name === 'string' &&
      'message' in value &&
      typeof value.message === 'string' &&
      'stack' in value &&
      typeof value.stack === 'string'
    );
  }

  /**
   * Get the current route path
   */
  #getCurrentRoute(): string {
    try {
      return this.#router.url;
    } catch {
      return window.location.pathname;
    }
  }

  /**
   * Classify the error for better categorization
   */
  #classifyError(error: ErrorCandidate): string {
    if (isHttpErrorResponse(error)) {
      return `http_error_${error.status}`;
    }

    if (isError(error)) {
      // Check for specific error types common in modern Angular apps
      if (this.#isChunkLoadError(error)) {
        return 'chunk_load_error';
      }

      if (
        error.message?.includes('Cannot read properties of undefined') ||
        error.message?.includes('Cannot read property') ||
        error.message?.includes('null is not an object')
      ) {
        return 'null_reference_error';
      }

      if (
        error.message?.includes('Network request failed') ||
        error.message?.includes('Failed to fetch') ||
        error.name === 'NetworkError'
      ) {
        return 'network_error';
      }

      return error.constructor.name;
    }

    if (typeof error === 'string') {
      return 'string_error';
    }

    return 'unknown_error';
  }

  /**
   * Check if error is related to lazy loading failures
   */
  #isChunkLoadError(error: Error): boolean {
    return (
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.name === 'ChunkLoadError' ||
      error.name === 'ModuleNotFoundError'
    );
  }

  /**
   * Extract stack trace from error
   */
  #extractStackTrace(error: ErrorCandidate): string | undefined {
    if (isError(error) && error.stack) {
      return error.stack;
    }

    if (
      error &&
      typeof error === 'object' &&
      'stack' in error &&
      typeof error.stack === 'string'
    ) {
      return error.stack;
    }

    return undefined;
  }

  /**
   * Determine error severity level
   */
  #determineErrorLevel(error: ErrorCandidate): ErrorLevel {
    if (isHttpErrorResponse(error)) {
      if (error.status >= 500) return 'high';
      if (error.status === 401 || error.status === 403) return 'high'; // Auth errors are important
      if (error.status >= 400) return 'medium';
      return 'low';
    }

    if (isError(error)) {
      // Critical JavaScript errors that break the app
      if (this.#isChunkLoadError(error)) {
        return 'critical';
      }

      // High priority errors that affect functionality
      if (
        error.name === 'ReferenceError' ||
        error.name === 'TypeError' ||
        error.message?.includes('Network request failed')
      ) {
        return 'high';
      }

      // Medium priority for other JavaScript errors
      return 'medium';
    }

    return 'low';
  }
}

/**
 * PostHog-compatible runOutsideAngular utility for both zoneless and zone-based apps
 * Based on the official PostHog Angular documentation
 */
// This would be exposed in the global environment whenever `zone.js` is
// included in the `polyfills` configuration property. Starting from Angular 17,
// users can opt-in to use zoneless change detection.
declare const Zone: unknown;

// In Angular 17 and future versions, zoneless support is forthcoming.
// Therefore, it's advisable to safely check whether the `run` function is
// available in the `<root>` context.
const isNgZoneEnabled =
  typeof Zone !== 'undefined' &&
  Zone &&
  typeof Zone === 'object' &&
  'root' in Zone &&
  Zone.root &&
  typeof Zone.root === 'object' &&
  'run' in Zone.root;

export function runOutsideAngular<T>(callback: () => T): T {
  // Running the `callback` within the root execution context enables Angular
  // processes (such as SSR and hydration) to continue functioning normally without
  // timeouts and delays that could affect the user experience. This approach is
  // necessary because some of the error tracking functionality continues to run in the background.
  return isNgZoneEnabled
    ? (Zone as { root: { run: <T>(callback: () => T) => T } }).root.run(
        callback,
      )
    : callback();
}

/**
 * Provider function for the global error handler
 */
export const provideGlobalErrorHandler = () => ({
  provide: ErrorHandler,
  useClass: GlobalErrorHandler,
});
