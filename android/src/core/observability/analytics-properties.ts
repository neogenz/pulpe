/**
 * What an event may carry: flat, and only these three types.
 *
 * `AnalyticsService.swift` walks nested dictionaries and arrays to filter them;
 * this side forbids the nesting instead, which is the same guarantee with
 * nothing to walk — a payload cannot be smuggled in under an innocent key.
 */
export type AnalyticsProperties = Record<string, string | number | boolean>;

/**
 * Words that name money. A key containing one as a whole component is dropped
 * rather than sent, so no amount can reach PostHog even by accident — the same
 * list as `AnalyticsService.financialWords` on iOS.
 */
const FINANCIAL_WORDS = new Set([
  "amount",
  "balance",
  "income",
  "savings",
  "total",
  "projection",
  "rollover",
  "expenses",
  "available",
]);

/** Matched anywhere in the key rather than as a component: `access_token_hint` is still a token. */
const SENSITIVE_FRAGMENTS = [
  "token",
  "password",
  "secret",
  "credential",
  "recovery",
  "pincode",
  "pin_code",
];

/** Keys that carry whatever the user typed — a budget line's name, a note, an error body. */
const TYPED_CONTENT_KEYS = new Set([
  "description",
  "label",
  "name",
  "title",
  "content",
  "text",
  "message",
]);

/**
 * Drops rather than redacts: a key that survives is one a dashboard can rely
 * on, and a redacted placeholder would look like a real value in a breakdown.
 *
 * Counting keys survive on purpose — `charges_count` says how many fixed
 * charges a budget started with, never what they were worth — which is the same
 * line iOS draws.
 */
export function sanitizeProperties(
  properties: AnalyticsProperties,
): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => isSafeKey(key)),
  );
}

function isSafeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (TYPED_CONTENT_KEYS.has(normalized)) return false;
  if (SENSITIVE_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return false;
  }
  return !normalized.split("_").some((word) => FINANCIAL_WORDS.has(word));
}
