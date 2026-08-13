import type { CaptureResult } from 'posthog-js';

type RouteTemplate = readonly string[];

const ROUTE_PARAMETER_PREFIX = ':';

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

// PostHog needs these technical identifiers for identity, replay and session
// grouping. `request_id` is intentionally retained for backend-error
// correlation. Every other generic/resource identifier is removed.
const ALLOWED_TECHNICAL_ID_FIELDS = new Set([
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$user_id',
  '$anon_distinct_id',
  '$pageview_id',
  '$insert_id',
  'request_id',
  'requestid',
]);

const COMPACT_RESOURCE_ID_FIELDS = new Set([
  'budgetid',
  'goalid',
  'templateid',
  'tagid',
  'transactionid',
  'lineid',
  'budgetlineid',
  'userid',
]);

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
  'email', // Person property only: `sanitizePersonProperties` restores it for `$set`/identify
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

// posthog-js derives these values from URL query parameters. The public
// landing tracks acquisition separately; authenticated app events must not
// forward query-derived values under standalone properties.
const QUERY_DERIVED_PROPERTY_NAMES = new Set(
  [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gad_source',
    'mc_cid',
    'gclid',
    'gclsrc',
    'dclid',
    'gbraid',
    'wbraid',
    'fbclid',
    'msclkid',
    'twclid',
    'li_fat_id',
    'igshid',
    'ttclid',
    'rdt_cid',
    'epik',
    'qclid',
    'sccid',
    'irclid',
    '_kx',
    'ph_keyword',
  ].flatMap((key) => [key, `$initial_${key}`, `$session_entry_${key}`]),
);

// Autocapture can serialize arbitrary text, attributes, selectors and hrefs.
// Those channels are never trusted. For click events only, `$elements` is
// rebuilt below from tag names and numeric sibling positions, then a fresh
// `$elements_chain` is generated from that safe structure.
const OPAQUE_AUTOCAPTURE_PROPERTY_NAMES = new Set([
  '$elements',
  '$elements_chain',
  '$element_selectors',
  '$el_text',
  '$external_click_url',
  '$selected_content',
  '$copy_type',
]);
const AUTOCAPTURE_ALLOWED_PROPERTY_NAMES = new Set([
  '$event_type',
  '$ce_version',
  'token',
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$user_id',
  '$anon_distinct_id',
  '$pageview_id',
  '$insert_id',
  '$lib',
  '$lib_version',
  '$config_defaults',
  '$browser',
  '$browser_version',
  '$device_type',
  '$os',
  '$os_name',
  '$os_version',
  '$screen_height',
  '$screen_width',
  '$viewport_height',
  '$viewport_width',
  '$raw_user_agent',
  '$host',
  '$pathname',
  '$current_url',
  '$referrer',
  '$referring_domain',
  '$session_entry_url',
  '$session_entry_pathname',
  '$session_entry_referrer',
  '$session_entry_referring_domain',
  '$time',
  '$sent_at',
  '$timezone',
  '$timezone_offset',
  'environment',
  'app_version',
  'app_commit',
  'platform',
]);
export const AUTOCAPTURE_TAG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const MAX_AUTOCAPTURE_ELEMENTS = 64;

// Alternative PostHog integrations can duplicate exception messages and
// fingerprints outside `$exception_list`. The strict exception schema below
// preserves only safe grouping structure, so these free-form duplicates must
// never survive independently.
const OPAQUE_EXCEPTION_PROPERTY_NAMES = new Set([
  '$exception_message',
  '$exception_value',
  '$exception_values',
  '$exception_type',
  '$exception_types',
  '$exception_fingerprint',
  '$exception_source',
]);

const WEB_ROUTE_TEMPLATES: readonly RouteTemplate[] = [
  [],
  ['welcome'],
  ['login'],
  ['signup'],
  ['forgot-password'],
  ['reset-password'],
  ['setup-vault-code'],
  ['enter-vault-code'],
  ['recover-vault-code'],
  ['maintenance'],
  ['legal', 'cgu'],
  ['legal', 'confidentialite'],
  ['complete-profile'],
  ['dashboard'],
  ['budget'],
  ['budget', ':id'],
  ['budget-templates'],
  ['budget-templates', 'create'],
  ['budget-templates', 'details', ':templateId'],
  ['savings-goals'],
  ['savings-goals', ':id'],
  ['settings'],
  ['settings', 'tags'],
  ['design-system'],
];

// Exact NestJS v1 route shapes. API paths are accepted with their canonical
// `/api/v1` prefix and without it because replay integrations can expose either
// a full request pathname or a controller-relative pathname.
const API_ROUTE_TEMPLATES: readonly RouteTemplate[] = [
  ['health'],
  ['maintenance', 'status'],
  ['app', 'version'],
  ['auth', 'validate'],
  ['currency', 'rate'],
  ['demo', 'session'],
  ['demo', 'cleanup'],
  ['encryption', 'vault-status'],
  ['encryption', 'salt'],
  ['encryption', 'validate-key'],
  ['encryption', 'setup-recovery'],
  ['encryption', 'regenerate-recovery'],
  ['encryption', 'recover'],
  ['encryption', 'verify-recovery-key'],
  ['encryption', 'change-pin'],
  ['users', 'me'],
  ['users', 'profile'],
  ['users', 'settings'],
  ['users', 'account'],
  ['whats-new', 'ios'],
  ['debug', 'test-service-error'],
  ['debug', 'test-log-levels'],
  ['debug', 'test-error', ':type'],

  // Static collection and action routes precede overlapping dynamic routes.
  ['budget-templates'],
  ['budget-templates', 'from-onboarding'],
  ['budget-templates', ':templateId', 'lines', 'bulk-operations'],
  ['budget-templates', ':templateId', 'lines', ':lineId'],
  ['budget-templates', ':id', 'lines'],
  ['budget-templates', ':id', 'usage'],
  ['budget-templates', ':id'],
  ['savings-goals'],
  ['savings-goals', 'withdrawal-options'],
  ['savings-goals', ':id', 'withdrawals'],
  ['savings-goals', ':id', 'progress'],
  ['savings-goals', ':id', 'contributions'],
  ['savings-goals', ':id', 'plan'],
  ['savings-goals', ':id', 'future-lines'],
  ['savings-goals', ':id', 'generation-stop'],
  ['savings-goals', ':id', 'deletion-impact'],
  ['savings-goals', ':id', 'deletion'],
  ['savings-goals', ':id'],
  ['transactions'],
  ['transactions', 'search'],
  ['transactions', 'budget', ':budgetId'],
  ['transactions', 'budget-line', ':budgetLineId'],
  ['transactions', ':id', 'toggle-check'],
  ['transactions', ':id', 'postpone'],
  ['transactions', ':id', 'spread'],
  ['transactions', ':id'],
  ['budget-lines'],
  ['budget-lines', 'savings-withdrawal'],
  ['budget-lines', 'savings-withdrawal', ':groupId'],
  ['budget-lines', 'spread'],
  ['budget-lines', 'spread', ':spreadGroupId'],
  ['budget-lines', 'budget', ':budgetId'],
  ['budget-lines', ':id', 'reset-from-template'],
  ['budget-lines', ':id', 'toggle-check'],
  ['budget-lines', ':id', 'postpone'],
  ['budget-lines', ':id', 'check-transactions'],
  ['budget-lines', ':id', 'spread'],
  ['budget-lines', ':id'],
  ['budgets'],
  ['budgets', 'generate'],
  ['budgets', 'export'],
  ['budgets', 'exists'],
  ['budgets', ':id', 'details'],
  ['budgets', ':id'],
  ['tags'],
  ['tags', ':id', 'history'],
  ['tags', ':id'],
];

const URL_SYSTEM_PROPERTIES = new Set([
  '$referrer',
  '$initial_referrer',
  '$session_entry_referrer',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  Object.prototype.toString.call(value) === '[object Object]';

const isSensitiveIdProperty = (key: string, normalizedKey: string): boolean => {
  if (ALLOWED_TECHNICAL_ID_FIELDS.has(normalizedKey)) return false;

  return (
    normalizedKey === 'id' ||
    normalizedKey === 'ids' ||
    normalizedKey === 'uuid' ||
    normalizedKey === 'uuids' ||
    normalizedKey === 'identifier' ||
    normalizedKey === 'identifiers' ||
    COMPACT_RESOURCE_ID_FIELDS.has(normalizedKey) ||
    /(?:^|[_-])(?:id|ids|uuid|uuids|identifier|identifiers)$/i.test(key) ||
    /(?:Id|Ids|ID|IDs|Uuid|Uuids|UUID|UUIDs|Identifier|Identifiers)$/.test(key)
  );
};

const isSensitiveProperty = (key: string, normalizedKey: string): boolean => {
  if (OPAQUE_AUTOCAPTURE_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  if (OPAQUE_EXCEPTION_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  if (QUERY_DERIVED_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  // Check if it's a financial property
  if (FINANCIAL_PROPERTY_NAMES.has(normalizedKey)) {
    return true;
  }

  // Check if it's a sensitive ID field
  if (isSensitiveIdProperty(key, normalizedKey)) {
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
  normalizedKey.includes('link') ||
  (normalizedKey.startsWith('$') && normalizedKey.endsWith('pathname')) ||
  URL_SYSTEM_PROPERTIES.has(normalizedKey);

const isRouteParameter = (segment: string): boolean =>
  segment.startsWith(ROUTE_PARAMETER_PREFIX);

const matchesRouteTemplate = (
  segments: readonly string[],
  template: RouteTemplate,
): boolean =>
  segments.length === template.length &&
  template.every(
    (templateSegment, index) =>
      isRouteParameter(templateSegment) || templateSegment === segments[index],
  );

const routeSpecificity = (template: RouteTemplate): number =>
  template.filter((segment) => !isRouteParameter(segment)).length;

const findMatchingRoute = (
  segments: readonly string[],
): { prefix: readonly string[]; template: RouteTemplate } | undefined => {
  const apiPrefix = segments[0] === 'api' && segments[1] === 'v1';
  const candidate = apiPrefix ? segments.slice(2) : segments;
  const templates = apiPrefix
    ? API_ROUTE_TEMPLATES
    : [...WEB_ROUTE_TEMPLATES, ...API_ROUTE_TEMPLATES];

  const template = templates
    .filter((item) => matchesRouteTemplate(candidate, item))
    .sort((left, right) => routeSpecificity(right) - routeSpecificity(left))[0];

  if (!template) return undefined;
  return { prefix: apiPrefix ? ['api', 'v1'] : [], template };
};

const SAFE_TECHNICAL_ASSET_PATH_PATTERN =
  /^\/(?:main(?:-[A-Za-z0-9_-]+)?|chunk-[A-Za-z0-9_-]+|runtime(?:-[A-Za-z0-9_-]+)?|polyfills(?:-[A-Za-z0-9_-]+)?)\.js$/;

const applyDynamicSegmentMasks = (pathname: string): string | null => {
  if (SAFE_TECHNICAL_ASSET_PATH_PATTERN.test(pathname)) return pathname;

  const leadingSlash = pathname.startsWith('/');
  const trailingSlash = pathname.length > 1 && pathname.endsWith('/');
  const segments = pathname.split('/').filter(Boolean);
  const match = findMatchingRoute(segments);

  if (!match) return null;

  const candidate = segments.slice(match.prefix.length);
  const sanitizedSegments = match.template.map((templateSegment, index) =>
    isRouteParameter(templateSegment) ? '[id]' : candidate[index],
  );
  const sanitizedPath = [...match.prefix, ...sanitizedSegments].join('/');
  if (sanitizedPath === '') return '/';

  return `${leadingSlash ? '/' : ''}${sanitizedPath}${trailingSlash ? '/' : ''}`;
};

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][\w+.-]*:/;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

/**
 * Supprime toute query/fragment et masque les segments dynamiques d'une URL.
 */
export const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return url;
  if (url === '' || url === '$direct') return url;

  try {
    const normalizedUrl = url.trimStart();
    const isAbsolute = ABSOLUTE_URL_PATTERN.test(normalizedUrl);
    const isProtocolRelative =
      !isAbsolute && PROTOCOL_RELATIVE_PATTERN.test(normalizedUrl);

    let parsed: URL;
    if (isAbsolute) {
      parsed = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    } else if (isProtocolRelative) {
      const protocol =
        typeof window !== 'undefined' ? window.location.protocol : 'https:';
      parsed = new URL(`${protocol}${normalizedUrl}`);
    } else {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost';
      parsed = new URL(normalizedUrl, base);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) return '';

    const sanitizedPath = applyDynamicSegmentMasks(parsed.pathname);
    const safePath = sanitizedPath ?? '';

    if (isAbsolute) {
      return `${parsed.protocol}//${parsed.host}${safePath}`;
    }

    if (isProtocolRelative) {
      return `//${parsed.host}${safePath}`;
    }

    return sanitizedPath ?? '/';
  } catch {
    return '';
  }
};

const SANITIZATION_DROPPED = Symbol('sanitization-dropped');
const MAX_GENERIC_DEPTH = 32;
const MAX_GENERIC_NODES = 2_048;
const MAX_GENERIC_PROPERTIES = 4_096;
const MAX_GENERIC_OUTPUT_CHARS = 256 * 1_024;
const MAX_GENERIC_STRING_CHARS = 16 * 1_024;

type GenericSanitizeResult = unknown | typeof SANITIZATION_DROPPED;

interface GenericTraversalContext {
  readonly active: WeakSet<object>;
  nodes: number;
  properties: number;
  outputChars: number;
}

const reserveGenericOutput = (
  context: GenericTraversalContext,
  chars: number,
): boolean => {
  if (context.outputChars + chars > MAX_GENERIC_OUTPUT_CHARS) return false;
  context.outputChars += chars;
  return true;
};

const sanitizePrimitive = (
  value: unknown,
  context: GenericTraversalContext,
): GenericSanitizeResult => {
  if (value === null) {
    return reserveGenericOutput(context, 4) ? null : SANITIZATION_DROPPED;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_GENERIC_STRING_CHARS) return SANITIZATION_DROPPED;
    return reserveGenericOutput(context, JSON.stringify(value).length)
      ? value
      : SANITIZATION_DROPPED;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return SANITIZATION_DROPPED;
    return reserveGenericOutput(context, String(value).length)
      ? value
      : SANITIZATION_DROPPED;
  }
  if (typeof value === 'boolean') {
    return reserveGenericOutput(context, value ? 4 : 5)
      ? value
      : SANITIZATION_DROPPED;
  }
  return SANITIZATION_DROPPED;
};

const enterGenericContainer = (
  value: object,
  context: GenericTraversalContext,
  depth: number,
): boolean => {
  if (
    depth > MAX_GENERIC_DEPTH ||
    context.active.has(value) ||
    context.nodes >= MAX_GENERIC_NODES ||
    !reserveGenericOutput(context, 2)
  ) {
    return false;
  }
  context.nodes += 1;
  context.active.add(value);
  return true;
};

const sanitizeRecordInternal = (
  obj: Record<string, unknown>,
  context: GenericTraversalContext,
  depth: number,
): Record<string, unknown> | typeof SANITIZATION_DROPPED => {
  if (!enterGenericContainer(obj, context, depth)) {
    return SANITIZATION_DROPPED;
  }

  const result: Record<string, unknown> = {};
  try {
    for (const [key, rawValue] of Object.entries(obj)) {
      context.properties += 1;
      if (context.properties > MAX_GENERIC_PROPERTIES) {
        return SANITIZATION_DROPPED;
      }

      const normalizedKey = key.toLowerCase();
      if (isSensitiveProperty(key, normalizedKey)) continue;

      if (!reserveGenericOutput(context, JSON.stringify(key).length + 2)) {
        return SANITIZATION_DROPPED;
      }

      const sanitized =
        isUrlKey(normalizedKey) && typeof rawValue === 'string'
          ? sanitizePrimitive(sanitizeUrl(rawValue), context)
          : sanitizeUnknown(rawValue, context, depth + 1);
      if (sanitized !== SANITIZATION_DROPPED) {
        result[key] = sanitized;
      }
    }
    return result;
  } finally {
    context.active.delete(obj);
  }
};

export const sanitizeRecord = (
  obj: Record<string, unknown>,
): Record<string, unknown> => {
  try {
    const sanitized = sanitizeRecordInternal(
      obj,
      {
        active: new WeakSet<object>(),
        nodes: 0,
        properties: 0,
        outputChars: 0,
      },
      0,
    );
    return sanitized === SANITIZATION_DROPPED ? {} : sanitized;
  } catch {
    return {};
  }
};

export const sanitizePersonProperties = (
  properties: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized = sanitizeRecord(properties);
  for (const key of ALLOWED_PERSON_PROPERTIES) {
    delete sanitized[key];
    const value = properties[key];
    if (typeof value === 'string' && value.length <= MAX_GENERIC_STRING_CHARS) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

function sanitizeUnknown(
  value: unknown,
  context: GenericTraversalContext,
  depth: number,
): GenericSanitizeResult {
  if (Array.isArray(value)) {
    if (!enterGenericContainer(value, context, depth)) {
      return SANITIZATION_DROPPED;
    }
    const result: unknown[] = [];
    try {
      for (const item of value) {
        context.properties += 1;
        if (
          context.properties > MAX_GENERIC_PROPERTIES ||
          !reserveGenericOutput(context, 1)
        ) {
          return SANITIZATION_DROPPED;
        }
        const sanitized = sanitizeUnknown(item, context, depth + 1);
        if (sanitized !== SANITIZATION_DROPPED) result.push(sanitized);
      }
      return result;
    } finally {
      context.active.delete(value);
    }
  }

  if (isRecord(value)) {
    return sanitizeRecordInternal(value, context, depth);
  }

  return sanitizePrimitive(value, context);
}

interface SanitizedAutocapture {
  readonly properties: Record<string, unknown>;
  readonly elements: Record<string, unknown>[];
  readonly elementsChain: string;
}

const sanitizeAutocaptureProperties = (
  value: unknown,
): SanitizedAutocapture | null => {
  if (
    !isRecord(value) ||
    value['$event_type'] !== 'click' ||
    value['$ce_version'] !== 1 ||
    !Array.isArray(value['$elements']) ||
    value['$elements'].length === 0 ||
    value['$elements'].length > MAX_AUTOCAPTURE_ELEMENTS
  ) {
    return null;
  }

  const elements: Record<string, unknown>[] = [];
  const chainSegments: string[] = [];
  for (const rawElement of value['$elements']) {
    if (!isRecord(rawElement) || typeof rawElement['tag_name'] !== 'string') {
      return null;
    }

    const tagName = rawElement['tag_name'].toLowerCase();
    const nthChild = rawElement['nth_child'];
    const nthOfType = rawElement['nth_of_type'];
    if (
      !AUTOCAPTURE_TAG_PATTERN.test(tagName) ||
      !Number.isSafeInteger(nthChild) ||
      !Number.isSafeInteger(nthOfType) ||
      (nthChild as number) < 1 ||
      (nthOfType as number) < 1
    ) {
      return null;
    }

    elements.push({
      tag_name: tagName,
      nth_child: nthChild,
      nth_of_type: nthOfType,
    });
    chainSegments.push(
      `${tagName}:nth-child="${nthChild}"nth-of-type="${nthOfType}"`,
    );
  }

  const properties: Record<string, unknown> = {};
  for (const key of AUTOCAPTURE_ALLOWED_PROPERTY_NAMES) {
    if (value[key] !== undefined) properties[key] = value[key];
  }

  return {
    properties,
    elements,
    elementsChain: chainSegments.join(';'),
  };
};

const REPLAY_EVENT_TYPE = {
  DOM_CONTENT_LOADED: 0,
  LOAD: 1,
  FULL_SNAPSHOT: 2,
  INCREMENTAL_SNAPSHOT: 3,
  META: 4,
  CUSTOM: 5,
  PLUGIN: 6,
} as const;

const REPLAY_INCREMENTAL_SOURCE = {
  MUTATION: 0,
  MOUSE_MOVE: 1,
  MOUSE_INTERACTION: 2,
  SCROLL: 3,
  VIEWPORT_RESIZE: 4,
  INPUT: 5,
  TOUCH_MOVE: 6,
  MEDIA_INTERACTION: 7,
  STYLE_SHEET_RULE: 8,
  CANVAS_MUTATION: 9,
  FONT: 10,
  LOG: 11,
  DRAG: 12,
  STYLE_DECLARATION: 13,
  SELECTION: 14,
  ADOPTED_STYLE_SHEET: 15,
  CUSTOM_ELEMENT: 16,
} as const;

const REPLAY_MOUSE_INTERACTION = { MIN: 0, MAX: 10 } as const;
const REPLAY_POINTER_TYPE = { MIN: 0, MAX: 2 } as const;
const REPLAY_MEDIA_INTERACTION = { MIN: 0, MAX: 4 } as const;

const REPLAY_DROPPED_EVENT = Symbol('replay-dropped-event');
type ReplayEventResult =
  | Record<string, unknown>
  | typeof REPLAY_DROPPED_EVENT
  | null;

const MAX_REPLAY_DEPTH = 64;
const MAX_REPLAY_VALUES = 250_000;
const MAX_REPLAY_PROPERTIES = 500_000;
const MAX_REPLAY_STRING_CHARS = 16 * 1_024 * 1_024;
const MAX_REPLAY_OUTPUT_CHARS = 8 * 1_024 * 1_024;

const isReplayTraversalSafe = (root: unknown): boolean => {
  const seen = new WeakSet<object>();
  const stack: { value: unknown; depth: number }[] = [
    { value: root, depth: 0 },
  ];
  let values = 0;
  let properties = 0;
  let stringChars = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    values += 1;
    if (values > MAX_REPLAY_VALUES || current.depth > MAX_REPLAY_DEPTH) {
      return false;
    }

    const { value } = current;
    if (typeof value === 'string') {
      stringChars += value.length;
      if (stringChars > MAX_REPLAY_STRING_CHARS) return false;
      continue;
    }
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      continue;
    }
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);

    const children = Array.isArray(value)
      ? value
      : isRecord(value)
        ? Object.values(value)
        : null;
    if (!children) return false;

    properties += children.length;
    if (properties > MAX_REPLAY_PROPERTIES) return false;
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({ value: children[index], depth: current.depth + 1 });
    }
  }

  return true;
};

const REPLAY_DROPPED_TAGS = new Set(['base', 'link', 'script', 'style']);
const REPLAY_BOOLEAN_ATTRIBUTES = new Set([
  'checked',
  'disabled',
  'hidden',
  'multiple',
  'open',
  'readonly',
  'required',
  'selected',
]);
const REPLAY_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'image',
  'month',
  'number',
  'password',
  'radio',
  'range',
  'reset',
  'search',
  'submit',
  'tel',
  'text',
  'time',
  'url',
  'week',
]);
const REPLAY_DIMENSION_PATTERN = /^-?\d+(?:\.\d+)?(?:px|%)?$/;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSafeIntegerInRange = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= minimum &&
  value <= maximum;

const isReplayNodeId = (value: unknown): value is number =>
  Number.isSafeInteger(value);

const maskReplayText = (value: string): string => value.replace(/\S/g, '*');

const sanitizeReplayAttributes = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;

  const attributes: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === 'type') {
      if (rawValue === null) {
        attributes[key] = null;
      } else if (
        typeof rawValue === 'string' &&
        REPLAY_INPUT_TYPES.has(rawValue.toLowerCase())
      ) {
        attributes[key] = rawValue.toLowerCase();
      }
      // Other `type` values can contain arbitrary MIME or application data.
      // Drop the attribute without rejecting an otherwise valid rrweb node.
      continue;
    }

    if (REPLAY_BOOLEAN_ATTRIBUTES.has(normalizedKey)) {
      if (rawValue === null) {
        attributes[key] = null;
      } else if (rawValue === true || typeof rawValue === 'string') {
        // Boolean HTML attributes are enabled by presence. rrweb can serialize
        // either an empty string or the original free-form attribute value;
        // normalize it so no DOM text is retained.
        attributes[key] = '';
      } else {
        return null;
      }
      continue;
    }

    if (normalizedKey === 'rr_width' || normalizedKey === 'rr_height') {
      if (
        typeof rawValue === 'string' &&
        REPLAY_DIMENSION_PATTERN.test(rawValue)
      ) {
        attributes[key] = rawValue;
      } else if (rawValue === null) {
        attributes[key] = null;
      } else {
        return null;
      }
    }
  }

  return attributes;
};

const sanitizeReplayNode = (value: unknown): ReplayEventResult => {
  if (!isRecord(value) || !isReplayNodeId(value['id'])) return null;

  const nodeType = value['type'];
  if (!Number.isSafeInteger(nodeType)) return null;

  const base: Record<string, unknown> = {
    type: nodeType,
    id: value['id'],
  };
  if (value['rootId'] !== undefined) {
    if (!isReplayNodeId(value['rootId'])) return null;
    base['rootId'] = value['rootId'];
  }
  for (const key of ['isShadowHost', 'isShadow']) {
    if (value[key] !== undefined) {
      if (value[key] !== true) return null;
      base[key] = true;
    }
  }

  if (nodeType === 0) {
    if (!Array.isArray(value['childNodes'])) return null;
    const childNodes: Record<string, unknown>[] = [];
    for (const child of value['childNodes']) {
      const sanitizedChild = sanitizeReplayNode(child);
      if (sanitizedChild === null) return null;
      if (sanitizedChild !== REPLAY_DROPPED_EVENT) {
        childNodes.push(sanitizedChild);
      }
    }
    base['childNodes'] = childNodes;
    if (
      value['compatMode'] === 'BackCompat' ||
      value['compatMode'] === 'CSS1Compat'
    ) {
      base['compatMode'] = value['compatMode'];
    }
    return base;
  }

  if (nodeType === 1) {
    if (
      typeof value['name'] !== 'string' ||
      value['name'].toLowerCase() !== 'html'
    ) {
      return null;
    }
    return {
      ...base,
      name: 'html',
      publicId: '',
      systemId: '',
    };
  }

  if (nodeType === 2) {
    if (
      typeof value['tagName'] !== 'string' ||
      !/^[a-z][a-z0-9-]{0,63}$/i.test(value['tagName']) ||
      !Array.isArray(value['childNodes'])
    ) {
      return null;
    }

    const tagName = value['tagName'].toLowerCase();
    if (REPLAY_DROPPED_TAGS.has(tagName)) return REPLAY_DROPPED_EVENT;

    const attributes = sanitizeReplayAttributes(value['attributes']);
    if (!attributes) return null;

    const childNodes: Record<string, unknown>[] = [];
    for (const child of value['childNodes']) {
      const sanitizedChild = sanitizeReplayNode(child);
      if (sanitizedChild === null) return null;
      if (sanitizedChild !== REPLAY_DROPPED_EVENT) {
        childNodes.push(sanitizedChild);
      }
    }

    const element: Record<string, unknown> = {
      ...base,
      tagName,
      attributes,
      childNodes,
    };
    for (const key of ['isSVG', 'needBlock', 'isCustom']) {
      if (value[key] !== undefined) {
        if (value[key] !== true) return null;
        element[key] = true;
      }
    }
    return element;
  }

  if (nodeType === 3) {
    if (typeof value['textContent'] !== 'string') return null;
    return {
      ...base,
      textContent:
        value['isStyle'] === true ? '' : maskReplayText(value['textContent']),
      ...(value['isStyle'] === true ? { isStyle: true } : {}),
    };
  }

  if (nodeType === 4 || nodeType === 5) {
    return { ...base, textContent: '' };
  }

  return null;
};

const copyReplayNumber = (
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  required = true,
): boolean => {
  if (source[key] === undefined && !required) return true;
  if (!isFiniteNumber(source[key])) return false;
  target[key] = source[key];
  return true;
};

const sanitizeReplayMutationData = (
  data: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (
    !Array.isArray(data['texts']) ||
    !Array.isArray(data['attributes']) ||
    !Array.isArray(data['removes']) ||
    !Array.isArray(data['adds'])
  ) {
    return null;
  }

  const texts: Record<string, unknown>[] = [];
  for (const item of data['texts']) {
    if (
      !isRecord(item) ||
      !isReplayNodeId(item['id']) ||
      (item['value'] !== null && typeof item['value'] !== 'string')
    ) {
      return null;
    }
    texts.push({
      id: item['id'],
      value:
        typeof item['value'] === 'string'
          ? maskReplayText(item['value'])
          : null,
    });
  }

  const attributes: Record<string, unknown>[] = [];
  for (const item of data['attributes']) {
    if (!isRecord(item) || !isReplayNodeId(item['id'])) return null;
    const sanitizedAttributes = sanitizeReplayAttributes(item['attributes']);
    if (!sanitizedAttributes) return null;
    attributes.push({ id: item['id'], attributes: sanitizedAttributes });
  }

  const removes: Record<string, unknown>[] = [];
  for (const item of data['removes']) {
    if (
      !isRecord(item) ||
      !isReplayNodeId(item['parentId']) ||
      !isReplayNodeId(item['id']) ||
      (item['isShadow'] !== undefined && typeof item['isShadow'] !== 'boolean')
    ) {
      return null;
    }
    removes.push({
      parentId: item['parentId'],
      id: item['id'],
      ...(typeof item['isShadow'] === 'boolean'
        ? { isShadow: item['isShadow'] }
        : {}),
    });
  }

  const adds: Record<string, unknown>[] = [];
  for (const item of data['adds']) {
    if (
      !isRecord(item) ||
      !isReplayNodeId(item['parentId']) ||
      (item['previousId'] !== undefined &&
        item['previousId'] !== null &&
        !isReplayNodeId(item['previousId'])) ||
      (item['nextId'] !== null && !isReplayNodeId(item['nextId']))
    ) {
      return null;
    }
    const node = sanitizeReplayNode(item['node']);
    if (node === null) return null;
    if (node === REPLAY_DROPPED_EVENT) continue;
    adds.push({
      parentId: item['parentId'],
      ...(item['previousId'] !== undefined
        ? { previousId: item['previousId'] }
        : {}),
      nextId: item['nextId'],
      node,
    });
  }

  return {
    source: REPLAY_INCREMENTAL_SOURCE.MUTATION,
    texts,
    attributes,
    removes,
    adds,
    ...(data['isAttachIframe'] === true ? { isAttachIframe: true } : {}),
  };
};

const sanitizeReplayPositions = (
  value: unknown,
): Record<string, unknown>[] | null => {
  if (!Array.isArray(value)) return null;
  const positions: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isReplayNodeId(item['id'])) return null;
    const position: Record<string, unknown> = { id: item['id'] };
    for (const key of ['x', 'y', 'timeOffset']) {
      if (!copyReplayNumber(item, position, key)) return null;
    }
    positions.push(position);
  }
  return positions;
};

const sanitizeReplayIncrementalData = (
  data: Record<string, unknown>,
): Record<string, unknown> | typeof REPLAY_DROPPED_EVENT | null => {
  const source = data['source'];
  if (typeof source !== 'number' || !Number.isSafeInteger(source)) return null;

  if (source === REPLAY_INCREMENTAL_SOURCE.MUTATION) {
    return sanitizeReplayMutationData(data);
  }

  if (
    source === REPLAY_INCREMENTAL_SOURCE.MOUSE_MOVE ||
    source === REPLAY_INCREMENTAL_SOURCE.TOUCH_MOVE ||
    source === REPLAY_INCREMENTAL_SOURCE.DRAG
  ) {
    const positions = sanitizeReplayPositions(data['positions']);
    return positions ? { source, positions } : null;
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.MOUSE_INTERACTION) {
    if (
      !isReplayNodeId(data['id']) ||
      !isSafeIntegerInRange(
        data['type'],
        REPLAY_MOUSE_INTERACTION.MIN,
        REPLAY_MOUSE_INTERACTION.MAX,
      ) ||
      (data['pointerType'] !== undefined &&
        !isSafeIntegerInRange(
          data['pointerType'],
          REPLAY_POINTER_TYPE.MIN,
          REPLAY_POINTER_TYPE.MAX,
        ))
    ) {
      return null;
    }
    const result: Record<string, unknown> = {
      source,
      id: data['id'],
      type: data['type'],
    };
    for (const key of ['x', 'y']) {
      if (!copyReplayNumber(data, result, key, false)) return null;
    }
    if (data['pointerType'] !== undefined) {
      result['pointerType'] = data['pointerType'];
    }
    return result;
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.SCROLL) {
    if (!isReplayNodeId(data['id'])) return null;
    const result: Record<string, unknown> = { source, id: data['id'] };
    return copyReplayNumber(data, result, 'x') &&
      copyReplayNumber(data, result, 'y')
      ? result
      : null;
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.VIEWPORT_RESIZE) {
    const result: Record<string, unknown> = { source };
    return copyReplayNumber(data, result, 'width') &&
      copyReplayNumber(data, result, 'height')
      ? result
      : null;
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.INPUT) {
    if (
      !isReplayNodeId(data['id']) ||
      typeof data['text'] !== 'string' ||
      typeof data['isChecked'] !== 'boolean' ||
      (data['userTriggered'] !== undefined &&
        typeof data['userTriggered'] !== 'boolean')
    ) {
      return null;
    }
    return {
      source,
      id: data['id'],
      text: maskReplayText(data['text']),
      isChecked: data['isChecked'],
      ...(typeof data['userTriggered'] === 'boolean'
        ? { userTriggered: data['userTriggered'] }
        : {}),
    };
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.MEDIA_INTERACTION) {
    if (
      !isReplayNodeId(data['id']) ||
      !isSafeIntegerInRange(
        data['type'],
        REPLAY_MEDIA_INTERACTION.MIN,
        REPLAY_MEDIA_INTERACTION.MAX,
      )
    ) {
      return null;
    }
    const result: Record<string, unknown> = {
      source,
      id: data['id'],
      type: data['type'],
    };
    for (const key of ['currentTime', 'volume', 'playbackRate']) {
      if (!copyReplayNumber(data, result, key, false)) return null;
    }
    for (const key of ['muted', 'loop']) {
      if (data[key] !== undefined) {
        if (typeof data[key] !== 'boolean') return null;
        result[key] = data[key];
      }
    }
    return result;
  }

  if (source === REPLAY_INCREMENTAL_SOURCE.SELECTION) {
    if (!Array.isArray(data['ranges'])) return null;
    const ranges: Record<string, unknown>[] = [];
    for (const range of data['ranges']) {
      if (!isRecord(range)) return null;
      const sanitizedRange: Record<string, unknown> = {};
      for (const key of ['start', 'startOffset', 'end', 'endOffset']) {
        if (!copyReplayNumber(range, sanitizedRange, key)) return null;
      }
      ranges.push(sanitizedRange);
    }
    return { source, ranges };
  }

  if (
    source >= REPLAY_INCREMENTAL_SOURCE.STYLE_SHEET_RULE &&
    source <= REPLAY_INCREMENTAL_SOURCE.CUSTOM_ELEMENT
  ) {
    return REPLAY_DROPPED_EVENT;
  }

  return null;
};

const REPLAY_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPLAY_MARKER_TAGS = new Set([
  '$posthog_config',
  '$recording_started',
  '$remote_config_received',
  '$session_id_change',
  '$session_options',
  'browser offline',
  'browser online',
  'recording paused',
  'recording resumed',
  'samplingDecisionMade',
  'sessionIdle',
  'sessionNoLongerIdle',
  'window hidden',
  'window visible',
]);

const sanitizeReplayCustomData = (
  data: Record<string, unknown>,
): Record<string, unknown> | typeof REPLAY_DROPPED_EVENT => {
  const tag = data['tag'];
  const payload = data['payload'];
  if (typeof tag !== 'string' || !isRecord(payload)) {
    return REPLAY_DROPPED_EVENT;
  }

  if (tag === '$pageview' || tag === '$url_changed') {
    if (typeof payload['href'] !== 'string') return REPLAY_DROPPED_EVENT;
    const href = sanitizeUrl(payload['href']);
    return href ? { tag, payload: { href } } : REPLAY_DROPPED_EVENT;
  }

  if (tag === '$session_starting' || tag === '$session_ending') {
    const sessionIdKey =
      tag === '$session_starting' ? 'previousSessionId' : 'nextSessionId';
    const sessionId = payload[sessionIdKey];
    return typeof sessionId === 'string' &&
      REPLAY_SESSION_ID_PATTERN.test(sessionId)
      ? { tag, payload: { [sessionIdKey]: sessionId } }
      : REPLAY_DROPPED_EVENT;
  }

  if (REPLAY_MARKER_TAGS.has(tag)) {
    return { tag, payload: {} };
  }

  return REPLAY_DROPPED_EVENT;
};

const sanitizeReplayEvent = (value: unknown): ReplayEventResult => {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value['type']) ||
    !isFiniteNumber(value['timestamp']) ||
    value['cv'] !== undefined
  ) {
    return null;
  }

  const base: Record<string, unknown> = {
    type: value['type'],
    timestamp: value['timestamp'],
  };
  if (value['delay'] !== undefined) {
    if (!isFiniteNumber(value['delay'])) return null;
    base['delay'] = value['delay'];
  }

  if (
    value['type'] === REPLAY_EVENT_TYPE.DOM_CONTENT_LOADED ||
    value['type'] === REPLAY_EVENT_TYPE.LOAD
  ) {
    return isRecord(value['data']) ? { ...base, data: {} } : null;
  }

  if (value['type'] === REPLAY_EVENT_TYPE.META) {
    if (!isRecord(value['data']) || typeof value['data']['href'] !== 'string') {
      return null;
    }
    const data: Record<string, unknown> = {
      href: sanitizeUrl(value['data']['href']),
    };
    return copyReplayNumber(value['data'], data, 'width') &&
      copyReplayNumber(value['data'], data, 'height')
      ? { ...base, data }
      : null;
  }

  if (value['type'] === REPLAY_EVENT_TYPE.FULL_SNAPSHOT) {
    if (!isRecord(value['data']) || !isRecord(value['data']['initialOffset'])) {
      return null;
    }
    const node = sanitizeReplayNode(value['data']['node']);
    if (node === null || node === REPLAY_DROPPED_EVENT) return null;
    const initialOffset: Record<string, unknown> = {};
    if (
      !copyReplayNumber(value['data']['initialOffset'], initialOffset, 'top') ||
      !copyReplayNumber(value['data']['initialOffset'], initialOffset, 'left')
    ) {
      return null;
    }
    return { ...base, data: { node, initialOffset } };
  }

  if (value['type'] === REPLAY_EVENT_TYPE.INCREMENTAL_SNAPSHOT) {
    if (!isRecord(value['data'])) return null;
    const data = sanitizeReplayIncrementalData(value['data']);
    if (data === null || data === REPLAY_DROPPED_EVENT) return data;
    return { ...base, data };
  }

  if (value['type'] === REPLAY_EVENT_TYPE.CUSTOM) {
    if (!isRecord(value['data'])) return REPLAY_DROPPED_EVENT;
    const data = sanitizeReplayCustomData(value['data']);
    return data === REPLAY_DROPPED_EVENT
      ? REPLAY_DROPPED_EVENT
      : { ...base, data };
  }

  if (value['type'] === REPLAY_EVENT_TYPE.PLUGIN) {
    return REPLAY_DROPPED_EVENT;
  }

  return null;
};

const sanitizeReplaySnapshot = (
  value: unknown,
): { data: Record<string, unknown>[]; bytes: number } | null => {
  if (!Array.isArray(value) || !isReplayTraversalSafe(value)) return null;

  const data: Record<string, unknown>[] = [];
  for (const item of value) {
    const sanitized = sanitizeReplayEvent(item);
    if (sanitized === null) return null;
    if (sanitized !== REPLAY_DROPPED_EVENT) data.push(sanitized);
  }
  if (data.length === 0) return null;

  let bytes = 0;
  for (const replayEvent of data) {
    const eventSize = JSON.stringify(replayEvent).length;
    bytes += eventSize;
    if (bytes > MAX_REPLAY_OUTPUT_CHARS) return null;
  }
  return {
    data,
    // Match posthog-js `estimateSize` and buffer accounting: it sums each
    // retained rrweb event's JSON string length, excluding array separators.
    bytes,
  };
};

const ALLOWED_EXCEPTION_TYPES = new Set([
  'AggregateError',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

const HTTP_EXCEPTION_TYPE_PATTERN =
  /^HTTP:\d{1,3}(?::[A-Za-z][A-Za-z0-9_.:-]{0,127}){0,2}$/;
const TECHNICAL_FUNCTION_PATTERN =
  /^(?=.{1,256}$)(?=.*[a-z])(?:(?:async|new) )?(?:[A-Za-z_$][A-Za-z0-9_$]*|<anonymous>)(?:\.(?:[A-Za-z_$][A-Za-z0-9_$]*|<anonymous>))*$/;

const isAllowedExceptionType = (value: unknown): value is string =>
  typeof value === 'string' &&
  (ALLOWED_EXCEPTION_TYPES.has(value) ||
    HTTP_EXCEPTION_TYPE_PATTERN.test(value));

const sanitizeExceptionFrame = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;

  const frame: Record<string, unknown> = { platform: 'web:javascript' };
  for (const key of ['lineno', 'colno']) {
    if (value[key] !== undefined && typeof value[key] !== 'number') return null;
    if (typeof value[key] === 'number') frame[key] = value[key];
  }
  if (value['in_app'] !== undefined && typeof value['in_app'] !== 'boolean') {
    return null;
  }
  if (typeof value['in_app'] === 'boolean') {
    frame['in_app'] = value['in_app'];
  }
  if (typeof value['function'] === 'string') {
    const functionName = value['function'];
    if (TECHNICAL_FUNCTION_PATTERN.test(functionName)) {
      frame['function'] = functionName;
    }
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
    exception['type'] = isAllowedExceptionType(item['type'])
      ? item['type']
      : 'Error';
    if (typeof item['thread_id'] === 'number') {
      exception['thread_id'] = item['thread_id'];
    }

    if (item['mechanism'] !== undefined) {
      if (!isRecord(item['mechanism'])) return null;
      const mechanism: Record<string, unknown> = { type: 'generic' };
      for (const key of ['handled', 'synthetic']) {
        if (
          item['mechanism'][key] !== undefined &&
          typeof item['mechanism'][key] !== 'boolean'
        ) {
          return null;
        }
        if (typeof item['mechanism'][key] === 'boolean') {
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
 * Nettoie un événement PostHog avant envoi : données financières, identifiants
 * métier, URL système, exceptions et snapshots replay.
 */
export const sanitizeEventPayload = (
  event: CaptureResult | null,
): CaptureResult | null => {
  if (!event) return null;
  if (event.event === '$autocapture' && !event.properties) return null;

  try {
    if (event.properties) {
      let replay: ReturnType<typeof sanitizeReplaySnapshot> = null;
      if (event.event === '$snapshot') {
        replay = sanitizeReplaySnapshot(event.properties['$snapshot_data']);
        if (!replay) return null;
      }

      let autocapture: ReturnType<typeof sanitizeAutocaptureProperties> = null;
      if (event.event === '$autocapture') {
        autocapture = sanitizeAutocaptureProperties(event.properties);
        if (!autocapture) return null;
      }

      const exceptionList = event.properties['$exception_list'];
      if (exceptionList !== undefined) {
        const sanitizedExceptionList = sanitizeExceptionList(exceptionList);
        if (!sanitizedExceptionList) return null;
        event.properties['$exception_list'] = sanitizedExceptionList;
      }

      // posthog-js injects its project routing token after the application
      // wrappers have already sanitized caller-provided properties. Preserve
      // only that SDK-added value across generic sanitization; `token` remains
      // sensitive so application tokens are dropped before they reach the SDK.
      const sdkToken = event.properties['token'];

      // Never send the raw rrweb tree through the generic recursive walker. It has
      // already been preflighted and rebuilt against the strict replay schema.
      const genericProperties = autocapture
        ? { ...autocapture.properties }
        : { ...(event.properties as Record<string, unknown>) };
      delete genericProperties['$snapshot_data'];
      delete genericProperties['$snapshot_bytes'];
      event.properties = sanitizeRecord(genericProperties);

      if (sdkToken !== undefined) {
        event.properties['token'] = sdkToken;
      }

      if (autocapture) {
        event.properties['$elements'] = autocapture.elements;
        event.properties['$elements_chain'] = autocapture.elementsChain;
      }

      if (replay) {
        event.properties['$snapshot_data'] = replay.data;
        event.properties['$snapshot_bytes'] = replay.bytes;
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
  } catch {
    return null;
  }
};
