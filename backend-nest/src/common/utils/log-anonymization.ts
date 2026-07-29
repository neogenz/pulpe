export function anonymizeIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;

  const clientIp = ip.split(',')[0]?.trim();
  if (!clientIp) return undefined;

  const ipv4Parts = clientIp.split('.');
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.x.x`;
  }

  if (clientIp.includes(':')) {
    const segments = clientIp.split(':');
    return `${segments[0]}:${segments[1]}::x`;
  }

  return '[IP_REDACTED]';
}

export function parseDeviceType(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }

  if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone')
  ) {
    return 'mobile';
  }

  return 'desktop';
}

export const toLogPath = (url?: string): string | undefined =>
  url?.split('?')[0];

const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';
const MAX_LOG_DEPTH = 5;
const MAX_LOG_STRING_LENGTH = 2048;
const MAX_LOG_COLLECTION_SIZE = 25;
const MAX_STACK_FRAMES = 20;
const FINANCIAL_LOG_KEYS = new Set([
  'available',
  'availabletospend',
  'remaining',
  'rollover',
  'consumed',
  'exchangerate',
]);

function isSensitiveLogKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[\s_-]/g, '');
  return (
    normalized.includes('amount') ||
    normalized.includes('balance') ||
    FINANCIAL_LOG_KEYS.has(normalized) ||
    ['income', 'expense', 'expenses', 'saving', 'savings'].some((suffix) =>
      normalized.endsWith(suffix),
    ) ||
    [
      'auth',
      'authorization',
      'proxyauthorization',
      'cookie',
      'setcookie',
      'pin',
      'q',
      'email',
      'name',
      'description',
      'label',
      'title',
      'content',
      'text',
      'cause',
      'err',
      'value',
      'cfturnstileresponse',
    ].includes(normalized) ||
    [
      'password',
      'token',
      'secret',
      'apikey',
      'clientkey',
      'recoverykey',
      'turnstileresponse',
      'message',
      'detail',
    ].some(
      (suffix) =>
        normalized.endsWith(suffix) || normalized.endsWith(`${suffix}s`),
    )
  );
}

export const sanitizeLogTechnicalValue = (
  value: unknown,
): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)
    ? value
    : undefined;

export function sanitizeStackFrames(stack?: string): string[] | undefined {
  if (!stack) return undefined;

  const frames = stack
    .split('\n')
    .slice(1)
    .filter((line) => /^\s*at\s+/.test(line))
    .slice(0, MAX_STACK_FRAMES)
    .map((line) => {
      const location = line.match(/^(.*?)(:\d+:\d+\)?)$/);
      const prefix = location?.[1] ?? line;
      const position = location?.[2] ?? '';
      return `${prefix.split(/[?#]/)[0]}${position}`.trim();
    });

  return frames.length > 0 ? frames : undefined;
}

/**
 * Sanitizes untrusted structured data before it reaches a logger.
 * Collections, strings, and nesting are bounded to keep debug logs usable.
 */
export function sanitizeLogValue(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const sanitize = (current: unknown, depth: number): unknown => {
    if (typeof current === 'string') {
      return current.length > MAX_LOG_STRING_LENGTH
        ? `${current.slice(0, MAX_LOG_STRING_LENGTH)}${TRUNCATED}`
        : current;
    }
    if (current === null || typeof current !== 'object') {
      return current;
    }
    if (depth >= MAX_LOG_DEPTH) {
      return TRUNCATED;
    }
    if (seen.has(current)) {
      return '[CIRCULAR]';
    }
    seen.add(current);

    if (Array.isArray(current)) {
      const result = current
        .slice(0, MAX_LOG_COLLECTION_SIZE)
        .map((item) => sanitize(item, depth + 1));
      if (current.length > MAX_LOG_COLLECTION_SIZE) result.push(TRUNCATED);
      return result;
    }

    const entries = Object.entries(current);
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of entries.slice(
      0,
      MAX_LOG_COLLECTION_SIZE,
    )) {
      result[key] = isSensitiveLogKey(key)
        ? REDACTED
        : sanitize(nestedValue, depth + 1);
    }
    if (entries.length > MAX_LOG_COLLECTION_SIZE) {
      result.__truncated__ = TRUNCATED;
    }
    return result;
  };

  return sanitize(value, 0);
}
