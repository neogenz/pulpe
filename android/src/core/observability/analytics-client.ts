import type { PostHog } from "posthog-react-native";
import type { AnalyticsEventName } from "pulpe-shared";

import {
  sanitizeProperties,
  type AnalyticsProperties,
} from "./analytics-properties";

// A leaf on purpose: the session store reports its own logout, and
// `analytics.ts` reads the session store, so the emitter cannot live there.
let client: PostHog | null = null;

export function setAnalyticsClient(next: PostHog): void {
  client = next;
}

/** The running client, for feature flags; null wherever analytics is off. */
export function getAnalyticsClient(): PostHog | null {
  return client;
}

/**
 * The one way an event leaves this app.
 *
 * The name is an `AnalyticsEventName`, so it can only be a string that already
 * exists in `ANALYTICS_EVENTS` — the cross-platform catalogue in
 * `shared/src/feature-flags.ts`. A list of names declared locally would be a
 * second catalogue that no dashboard knows about.
 */
export function captureEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  void client?.capture(event, sanitizeProperties(properties));
}
