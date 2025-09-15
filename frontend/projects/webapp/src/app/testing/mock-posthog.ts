import { signal } from '@angular/core';
import { vi } from 'vitest';

/**
 * Creates a mock PostHogService for testing
 * @returns Mock PostHogService with spy functions
 */
export function createMockPostHogService() {
  return {
    isInitialized: signal(true),
    isEnabled: signal(true),
    enableTracking: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
    captureException: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    register: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Logger for testing
 * @returns Mock Logger with spy functions
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
}

/**
 * Helper to verify PostHog data sanitization
 * @param properties - The properties to check
 * @returns Object with verification results
 */
export function verifyDataSanitization(
  properties: Record<string, unknown> | undefined,
) {
  if (!properties) {
    return {
      hasSensitiveData: false,
      errors: [],
    };
  }

  const errors: string[] = [];
  const sensitivePatterns = {
    password: /password|pwd|pass|secret/i,
    token: /token|jwt|bearer|api[_-]?key/i,
    financial: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}|CHF\s*[\d,.']+/,
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  };

  for (const [key, value] of Object.entries(properties)) {
    const stringValue = String(value);

    // Check for passwords and tokens
    if (sensitivePatterns.password.test(key)) {
      if (stringValue !== '[REDACTED]') {
        errors.push(`Password field '${key}' is not redacted`);
      }
    }

    if (sensitivePatterns.token.test(key)) {
      if (stringValue !== '[REDACTED]') {
        errors.push(`Token field '${key}' is not redacted`);
      }
    }

    // Check for financial data
    if (sensitivePatterns.financial.test(stringValue)) {
      if (
        !stringValue.includes('[MASKED]') &&
        !stringValue.includes('[REDACTED]')
      ) {
        errors.push(`Financial data in '${key}' is not masked`);
      }
    }

    // Check for email addresses
    if (sensitivePatterns.email.test(stringValue)) {
      if (!stringValue.includes('***') && !stringValue.includes('[REDACTED]')) {
        errors.push(`Email in '${key}' is not masked`);
      }
    }
  }

  return {
    hasSensitiveData: errors.length > 0,
    errors,
  };
}
