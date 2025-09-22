import type { CaptureResult, Properties } from 'posthog-js';

type DynamicSegmentMask = readonly [RegExp, string];

const POSTHOG_SYSTEM_FIELDS = new Set([
  'token',
  'api_key',
  'distinct_id',
  '$anon_distinct_id',
  '$lib',
  '$lib_version',
  '$user_id',
  '$current_url',
  '$pathname',
]);

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

const SECRET_PROPERTY_KEYWORDS = [
  'password',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
];

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

const isUrlKey = (normalizedKey: string): boolean =>
  normalizedKey.includes('url') || normalizedKey.includes('href');

const shouldFilterProperty = (normalizedKey: string): boolean => {
  if (POSTHOG_SYSTEM_FIELDS.has(normalizedKey)) {
    return false;
  }

  return (
    FINANCIAL_PROPERTY_NAMES.has(normalizedKey) ||
    SECRET_PROPERTY_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))
  );
};

const applyDynamicSegmentMasks = (pathname: string): string =>
  DYNAMIC_SEGMENT_MASKS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    pathname,
  );

/**
 * Supprime les paramètres sensibles et masque les segments dynamiques d'une URL.
 */
export const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return url;

  try {
    const isAbsolute = /^[a-zA-Z][\w+.-]*:/.test(url);
    const base = isAbsolute
      ? undefined
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(url, base);

    const sanitizedParams = new URLSearchParams(parsed.searchParams);
    for (const key of Array.from(sanitizedParams.keys())) {
      if (PROTECTED_QUERY_PARAMETERS.has(key.toLowerCase())) {
        sanitizedParams.delete(key);
      }
    }

    const sanitizedPath = applyDynamicSegmentMasks(parsed.pathname);
    const search = sanitizedParams.toString();
    const hash = parsed.hash;

    if (isAbsolute) {
      return `${parsed.protocol}//${parsed.host}${sanitizedPath}${search ? `?${search}` : ''}${hash}`;
    }

    return `${sanitizedPath}${search ? `?${search}` : ''}${hash}`;
  } catch {
    return applyDynamicSegmentMasks(url);
  }
};

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (isRecord(value)) {
    return sanitizeRecord(value);
  }

  return value;
};

const sanitizeRecord = (
  obj: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase();

    if (shouldFilterProperty(normalizedKey)) {
      continue;
    }

    if (isUrlKey(normalizedKey) && typeof rawValue === 'string') {
      result[key] = sanitizeUrl(rawValue);
      continue;
    }

    result[key] = sanitizeValue(rawValue);
  }

  return result;
};

const sanitizeProperties = (properties: Record<string, unknown>): Properties =>
  sanitizeRecord(properties) as Properties;

/**
 * Sanitize arbitrary analytics properties before sending to PostHog.
 * Re-uses the same filtering rules as event payload sanitization.
 */
export const sanitizeAnalyticsProperties = (
  properties: Record<string, unknown>,
): Properties => sanitizeProperties(properties);

/**
 * Nettoie un événement PostHog sans retirer les champs système indispensables.
 */
export const sanitizeEventPayload = (
  event: CaptureResult | null,
): CaptureResult | null => {
  if (!event) return null;

  if (event.properties) {
    const currentUrl = event.properties['$current_url'];
    if (typeof currentUrl === 'string') {
      event.properties['$current_url'] = sanitizeUrl(currentUrl);
    }
    event.properties = sanitizeProperties(
      event.properties as Record<string, unknown>,
    );
  }

  if (event.$set) {
    event.$set = sanitizeProperties(event.$set as Record<string, unknown>);
  }

  if (event.$set_once) {
    event.$set_once = sanitizeProperties(
      event.$set_once as Record<string, unknown>,
    );
  }

  return event;
};
