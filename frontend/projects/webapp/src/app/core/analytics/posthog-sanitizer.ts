import type { CaptureResult } from 'posthog-js';

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

const SECRET_PROPERTY_KEYWORDS = ['password', 'secret', 'credential'];

const SECRET_PROPERTY_SUFFIXES = ['token', 'tokenid', 'apikey', 'secretkey'];

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

const containsSensitiveKeyword = (normalizedKey: string): boolean => {
  if (
    SECRET_PROPERTY_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))
  ) {
    return true;
  }

  const strippedKey = normalizedKey.replace(/[^a-z0-9]/g, '');
  return SECRET_PROPERTY_SUFFIXES.some(
    (suffix) =>
      strippedKey.endsWith(suffix) || normalizedKey.endsWith(`_${suffix}`),
  );
};

const isUrlKey = (normalizedKey: string): boolean =>
  normalizedKey.includes('url') || normalizedKey.includes('href');

const shouldFilterProperty = (normalizedKey: string): boolean => {
  if (POSTHOG_SYSTEM_FIELDS.has(normalizedKey)) {
    return false;
  }

  if (FINANCIAL_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  return containsSensitiveKeyword(normalizedKey);
};

const applyDynamicSegmentMasks = (pathname: string): string =>
  DYNAMIC_SEGMENT_MASKS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    pathname,
  );

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][\w+.-]*:/;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

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
    const hash = parsed.hash;
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

    if (shouldFilterProperty(normalizedKey)) {
      continue;
    }

    if (isUrlKey(normalizedKey) && typeof rawValue === 'string') {
      result[key] = sanitizeUrl(rawValue);
      continue;
    }

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
    // Remplace la map de propriétés par une version nettoyée avant l'envoi PostHog.
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
