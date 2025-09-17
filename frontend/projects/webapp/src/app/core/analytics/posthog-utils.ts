import type { JsonType } from 'posthog-js';

/**
 * Constants for financial data sanitization patterns
 */
export const FINANCIAL_PATTERNS = {
  CHF_PREFIX: /CHF\s*[\d\s''',.-]+/gi,
  CHF_SUFFIX: /[\d\s''',.-]+\s*CHF/gi,
  SWISS_NUMBER: /\d{1,3}(?:['''\s]\d{3})*(?:[.,]\d{1,2})?/g,
  DECIMAL_AMOUNT: /\d+[.,]\d{2}\b/g,
  PERCENTAGE: /\d+[.,]?\d*\s*%/g,
  LARGE_NUMBER: /\b\d{4,}\b/g,
} as const;

/**
 * Patterns to identify financial-related property keys
 */
export const FINANCIAL_KEY_PATTERNS = [
  /amount/i,
  /balance/i,
  /total/i,
  /price/i,
  /cost/i,
  /value/i,
  /payment/i,
  /revenue/i,
  /income/i,
  /expense/i,
  /budget/i,
  /saving/i,
  /montant/i, // French for amount
  /solde/i, // French for balance
  /depense/i, // French for expense
  /revenu/i, // French for income
] as const;

/**
 * Patterns to identify sensitive property keys that should be redacted
 */
export const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /key/i,
  /secret/i,
  /auth/i,
  /credential/i,
  /credit.*card/i,
  /ssn/i,
  /social.*security/i,
] as const;

/**
 * Sanitize financial data in strings by masking amounts and numbers
 */
export function sanitizeFinancialString(text: string): string {
  return text
    .replace(FINANCIAL_PATTERNS.CHF_PREFIX, 'CHF ***')
    .replace(FINANCIAL_PATTERNS.CHF_SUFFIX, '*** CHF')
    .replace(FINANCIAL_PATTERNS.LARGE_NUMBER, '***')
    .replace(FINANCIAL_PATTERNS.SWISS_NUMBER, '***')
    .replace(FINANCIAL_PATTERNS.DECIMAL_AMOUNT, '***')
    .replace(FINANCIAL_PATTERNS.PERCENTAGE, '***%');
}

/**
 * Check if a property key indicates financial data that should be masked
 */
export function isFinancialKey(key: string): boolean {
  return FINANCIAL_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Check if a property key is sensitive and should be redacted
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Mask email address for privacy while preserving domain
 */
export function maskEmail(email: string): string {
  try {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return '[REDACTED]';
    }

    const maskedLocal =
      local.length > 2 ? `${local.substring(0, 2)}***` : '***';

    return `${maskedLocal}@${domain}`;
  } catch {
    return '[REDACTED]';
  }
}

/**
 * Convert unknown value to JsonType safely for PostHog compatibility
 */
export function toJsonType(value: unknown): JsonType {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (Array.isArray(value)) return value.map((item) => toJsonType(item));
  if (typeof value === 'object') {
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    const result: Record<string, JsonType> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = toJsonType(v);
    }
    return result;
  }

  // Handle special types that need descriptive conversion
  if (typeof value === 'function') {
    return `[Function]`;
  }
  if (typeof value === 'symbol') {
    return `[Symbol: ${value.description || 'unknown'}]`;
  }

  return String(value);
}

/**
 * Sanitize financial data in nested objects and arrays.
 *
 * Philosophy: PostHog is for behavioral analytics, not storing financial amounts.
 * We only sanitize obvious financial strings (e.g., "CHF 150" → "CHF ***")
 * to protect against accidental exposure in session recordings or logs.
 *
 * Numbers are left as-is because:
 * - We shouldn't send financial amounts to PostHog anyway
 * - Impossible to distinguish amounts vs years/IDs without context
 * - If amounts are sent, it's an app-level issue, not a sanitization issue
 */
export function deepSanitizeFinancialData(obj: JsonType): JsonType {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Sanitize strings containing financial info (e.g., "CHF 150" → "CHF ***")
  if (typeof obj === 'string') {
    return sanitizeFinancialString(obj);
  }

  // Recursively sanitize arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitizeFinancialData(item));
  }

  // Recursively sanitize objects
  if (typeof obj === 'object') {
    const sanitized: Record<string, JsonType> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Mask values for keys that clearly indicate financial data
      if (isFinancialKey(key)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = deepSanitizeFinancialData(toJsonType(value));
      }
    }
    return sanitized;
  }

  // For all other types (numbers, booleans, etc.) - return as-is
  // If numbers contain financial data, the issue is sending them to PostHog,
  // not the sanitization logic
  return obj;
}

/**
 * Get CSS selectors for masking financial elements in session recordings
 */
export function getFinancialMaskSelectors(): string {
  return [
    '.financial-amount',
    '.financial-title',
    '[class*="financial"]',
    '[class*="amount"]',
    '[class*="balance"]',
    '[class*="total"]',
    '[data-financial]',
    'input[type="number"]',
  ].join(', ');
}
