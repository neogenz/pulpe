/**
 * IMPORTANT: PostHog SDK does NOT automatically filter authentication tokens.
 * Currently not filtering tokens because:
 * 1. We don't send user objects or auth context in events
 * 2. We control all tracking code (solo developer)
 *
 * If we ever start tracking objects that might contain auth_token,
 * refreshToken, access_token, etc., add filtering here.
 */

import type { CaptureResult } from 'posthog-js';

type DynamicSegmentMask = readonly [RegExp, string];

// Financial fields we want to remove for privacy
const FINANCIAL_PROPERTY_NAMES = new Set(
  [
    'amount',
    'balance',
    'available_amount',
    'availableamount',
    'planned_amount',
    'plannedamount',
    'budget_amount',
    'budgetamount',
    'total',
    'income',
    'expense',
    'expenses',
    'saving',
    'savings',
  ].map((key) => key.toLowerCase()),
);

// Specific sensitive keywords to filter
const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'credential',
  'credit_card',
  'creditcard',
  'ssn',
  'social_security',
];

// Specific property names to filter (exact match)
const SENSITIVE_EXACT_KEYS = new Set([
  'apikey', // Generic API key fields - note: PostHog uses 'api_key' and 'token' which are different
]);

const PROTECTED_QUERY_PARAMETERS = new Set(
  ['budgetId', 'transactionId', 'templateId', 'token'].map((param) =>
    param.toLowerCase(),
  ),
);

const DYNAMIC_SEGMENT_MASKS: readonly DynamicSegmentMask[] = [
  [/\/budgets?\/[a-zA-Z0-9-]+/gi, '/budget/[id]'],
  [/\/transactions?\/[a-zA-Z0-9-]+/gi, '/transaction/[id]'],
  [/\/templates?\/[a-zA-Z0-9-]+/gi, '/template/[id]'],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  Object.prototype.toString.call(value) === '[object Object]';

const isSensitiveProperty = (normalizedKey: string): boolean => {
  // Check if it's a financial property
  if (FINANCIAL_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  // Check exact match for sensitive keys
  if (SENSITIVE_EXACT_KEYS.has(normalizedKey)) {
    return true;
  }

  // Check if it contains sensitive keywords
  return SENSITIVE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword));
};

const isUrlKey = (normalizedKey: string): boolean =>
  normalizedKey.includes('url') || normalizedKey.includes('href');

const applyDynamicSegmentMasks = (pathname: string): string =>
  DYNAMIC_SEGMENT_MASKS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    pathname,
  );

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][\w+.-]*:/;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

const sanitizeHashFragment = (hash: string): string => {
  if (!hash) return '';

  const trimmedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmedHash) return '';

  // Treat hash fragments that look like query strings (e.g. auth responses)
  if (trimmedHash.includes('=')) {
    try {
      const params = new URLSearchParams(trimmedHash);
      for (const key of Array.from(params.keys())) {
        const normalizedKey = key.toLowerCase();
        if (
          PROTECTED_QUERY_PARAMETERS.has(normalizedKey) ||
          isSensitiveProperty(normalizedKey)
        ) {
          params.delete(key);
        }
      }

      const sanitized = params.toString();
      return sanitized ? `#${sanitized}` : '';
    } catch {
      return '';
    }
  }

  const normalizedHash = trimmedHash.toLowerCase();
  if (
    isSensitiveProperty(normalizedHash) ||
    PROTECTED_QUERY_PARAMETERS.has(normalizedHash)
  ) {
    return '';
  }

  if (trimmedHash.startsWith('/')) {
    return `#${applyDynamicSegmentMasks(trimmedHash)}`;
  }

  return `#${trimmedHash}`;
};

/**
 * Supprime les paramètres sensibles et masque les segments dynamiques d'une URL.
 */
export const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return url;

  try {
    const isAbsolute = ABSOLUTE_URL_PATTERN.test(url);
    const isProtocolRelative =
      !isAbsolute && PROTOCOL_RELATIVE_PATTERN.test(url);

    let parsed: URL;
    if (isAbsolute) {
      parsed = new URL(url);
    } else if (isProtocolRelative) {
      const protocol =
        typeof window !== 'undefined' ? window.location.protocol : 'https:';
      parsed = new URL(`${protocol}${url}`);
    } else {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost';
      parsed = new URL(url, base);
    }

    const sanitizedParams = new URLSearchParams(parsed.searchParams);
    for (const key of Array.from(sanitizedParams.keys())) {
      if (PROTECTED_QUERY_PARAMETERS.has(key.toLowerCase())) {
        sanitizedParams.delete(key);
      }
    }

    const sanitizedPath = applyDynamicSegmentMasks(parsed.pathname);
    const search = sanitizedParams.toString();
    const hash = sanitizeHashFragment(parsed.hash);
    const query = search ? `?${search}` : '';

    if (isAbsolute) {
      return `${parsed.protocol}//${parsed.host}${sanitizedPath}${query}${hash}`;
    }

    if (isProtocolRelative) {
      return `//${parsed.host}${sanitizedPath}${query}${hash}`;
    }

    return `${sanitizedPath}${query}${hash}`;
  } catch {
    return applyDynamicSegmentMasks(url);
  }
};

export const sanitizeRecord = (
  obj: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase();

    // Skip sensitive properties (financial data, passwords, etc.)
    if (isSensitiveProperty(normalizedKey)) {
      continue;
    }

    // Sanitize URLs to remove dynamic segments
    if (isUrlKey(normalizedKey) && typeof rawValue === 'string') {
      result[key] = sanitizeUrl(rawValue);
      continue;
    }

    // Recursively sanitize nested objects and arrays
    result[key] = sanitizeUnknown(rawValue);
  }

  return result;
};

function sanitizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (isRecord(value)) {
    return sanitizeRecord(value);
  }

  return value;
}

/**
 * Nettoie un événement PostHog en retirant les données financières sensibles.
 * PostHog gère ses propres champs système, on ne touche qu'aux données métier.
 */
export const sanitizeEventPayload = (
  event: CaptureResult | null,
): CaptureResult | null => {
  if (!event) return null;

  if (event.properties) {
    // Sanitize the current URL if present
    const currentUrl = event.properties['$current_url'];
    if (typeof currentUrl === 'string') {
      event.properties['$current_url'] = sanitizeUrl(currentUrl);
    }
    // Clean sensitive properties from the event
    event.properties = sanitizeRecord(
      event.properties as Record<string, unknown>,
    );
  }

  if (event.$set) {
    event.$set = sanitizeRecord(event.$set as Record<string, unknown>);
  }

  if (event.$set_once) {
    event.$set_once = sanitizeRecord(
      event.$set_once as Record<string, unknown>,
    );
  }

  return event;
};
