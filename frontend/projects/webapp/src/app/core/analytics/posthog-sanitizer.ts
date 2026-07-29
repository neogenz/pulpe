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
    'target_amount',
    'targetamount',
    'ending_balance',
    'endingbalance',
    'consumed',
    'remaining',
    'spent',
    'earned',
    'saved',

    // Total variants
    'total_amount',
    'total_income',
    'total_expenses',
    'total_balance',
    'total_savings',
    'totalamount',
    'totalincome',
    'totalexpenses',
    'totalbalance',
    'totalsavings',

    // Monthly variants
    'monthly_amount',
    'monthly_income',
    'monthly_expenses',
    'monthly_balance',
    'monthly_savings',
    'monthlyamount',
    'monthlyincome',
    'monthlyexpenses',
    'monthlybalance',
    'monthlysavings',

    // Annual variants
    'annual_amount',
    'annual_income',
    'annual_expenses',
    'annual_savings',
    'annualamount',
    'annualincome',
    'annualexpenses',
    'annualsavings',

    // Available/Planned variants
    'available_balance',
    'availablebalance',

    // Balance variants
    'opening_balance',
    'openingbalance',
    'closing_balance',
    'closingbalance',
    'initial_balance',
    'initialbalance',

    // Amount suffixes
    'signup_amount',
    'signupamount',

    // Balance with amount suffix
    'balance_available',
    'balanceavailable',
  ].map((key) => key.toLowerCase()),
);

// Resource IDs that should not be sent to PostHog (they expose user's specific entities)
// Note: We DO keep some IDs like budget_id, goal_id for analytics grouping/funnels
// but remove IDs that would expose internal transaction/line details
const SENSITIVE_ID_FIELDS = new Set(
  [
    'transaction_id',
    'transactionid',
    'line_id',
    'lineid',
    'budget_line_id',
    'budgetlineid',
  ].map((key) => key.toLowerCase()),
);

// Specific sensitive keywords to filter
const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'credential',
  'token',
  'recovery',
  'pin_code',
  'pincode',
  'credit_card',
  'creditcard',
  'ssn',
  'social_security',
];

// Specific property names to filter (exact match)
const SENSITIVE_EXACT_KEYS = new Set([
  'apikey', // Generic API key fields - note: PostHog uses 'api_key' and 'token' which are different
  'token',
  'description',
  'label',
  'name',
  'title',
  'content',
  'text',
  'message',
]);

const ALLOWED_PERSON_PROPERTIES = new Set([
  'email',
  'name',
  'supabase_user_id',
]);

const PROTECTED_QUERY_PARAMETERS = new Set(
  ['budgetId', 'transactionId', 'templateId', 'token', 'q'].map((param) =>
    param.toLowerCase(),
  ),
);

const DYNAMIC_SEGMENT_MASKS: readonly DynamicSegmentMask[] = [
  [/\/budgets?\/[a-zA-Z0-9-]+/gi, '/budget/[id]'],
  [/\/transactions?\/(?!search(?:\/|$))[a-zA-Z0-9-]+/gi, '/transaction/[id]'],
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

  // Check if it's a sensitive ID field
  if (SENSITIVE_ID_FIELDS.has(normalizedKey)) {
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
  normalizedKey.includes('url') ||
  normalizedKey.includes('href') ||
  normalizedKey.includes('link');

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
      const normalizedKey = key.toLowerCase();
      if (
        PROTECTED_QUERY_PARAMETERS.has(normalizedKey) ||
        isSensitiveProperty(normalizedKey)
      ) {
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
    return '';
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

const sanitizePersonProperties = (
  properties: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized = sanitizeRecord(properties);
  for (const key of ALLOWED_PERSON_PROPERTIES) {
    if (properties[key] !== undefined) {
      sanitized[key] = properties[key];
    }
  }
  return sanitized;
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

const sanitizeExceptionFrame = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;

  const frame: Record<string, unknown> = {};
  for (const key of [
    'platform',
    'function',
    'module',
    'lineno',
    'colno',
    'in_app',
    'instruction_addr',
    'addr_mode',
    'chunk_id',
  ]) {
    if (value[key] !== undefined) frame[key] = value[key];
  }
  for (const key of ['filename', 'abs_path']) {
    if (typeof value[key] === 'string') {
      frame[key] = sanitizeUrl(value[key]).split(/[?#]/)[0];
    }
  }
  return frame;
};

const sanitizeExceptionList = (value: unknown): unknown[] | null => {
  if (!Array.isArray(value)) return null;

  const sanitized: unknown[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;

    const exception: Record<string, unknown> = {};
    if (typeof item['type'] === 'string') exception['type'] = item['type'];
    if (typeof item['module'] === 'string')
      exception['module'] = item['module'];
    if (typeof item['thread_id'] === 'number') {
      exception['thread_id'] = item['thread_id'];
    }

    if (item['mechanism'] !== undefined) {
      if (!isRecord(item['mechanism'])) return null;
      const mechanism: Record<string, unknown> = {};
      for (const key of ['handled', 'type', 'synthetic']) {
        if (item['mechanism'][key] !== undefined) {
          mechanism[key] = item['mechanism'][key];
        }
      }
      exception['mechanism'] = mechanism;
    }

    if (item['stacktrace'] !== undefined) {
      if (!isRecord(item['stacktrace'])) return null;
      const frames = item['stacktrace']['frames'];
      if (!Array.isArray(frames)) return null;
      const sanitizedFrames = frames.map(sanitizeExceptionFrame);
      if (sanitizedFrames.some((frame) => frame === null)) return null;
      exception['stacktrace'] = {
        type: 'raw',
        frames: sanitizedFrames,
      };
    }

    sanitized.push(exception);
  }

  return sanitized;
};

/**
 * Nettoie un événement PostHog en retirant les données financières sensibles.
 * PostHog gère ses propres champs système, on ne touche qu'aux données métier.
 */
export const sanitizeEventPayload = (
  event: CaptureResult | null,
): CaptureResult | null => {
  if (!event) return null;

  if (event.properties) {
    const exceptionList = event.properties['$exception_list'];
    if (exceptionList !== undefined) {
      const sanitizedExceptionList = sanitizeExceptionList(exceptionList);
      if (!sanitizedExceptionList) return null;
      event.properties['$exception_list'] = sanitizedExceptionList;
    }

    // PostHog SDK injects 'token' into properties — preserve it through sanitization
    const sdkToken = event.properties['token'];

    // Sanitize the current URL if present
    const currentUrl = event.properties['$current_url'];
    if (typeof currentUrl === 'string') {
      event.properties['$current_url'] = sanitizeUrl(currentUrl);
    }
    // Clean sensitive properties from the event
    event.properties = sanitizeRecord(
      event.properties as Record<string, unknown>,
    );

    // Restore PostHog SDK field
    if (sdkToken !== undefined) {
      event.properties['token'] = sdkToken;
    }
  }

  if (event.$set) {
    event.$set = sanitizePersonProperties(
      event.$set as Record<string, unknown>,
    );
  }

  if (event.$set_once) {
    event.$set_once = sanitizeRecord(
      event.$set_once as Record<string, unknown>,
    );
  }

  return event;
};
