import { useEffect, useState } from "react";

import { getAnalyticsClient } from "./analytics";

/** A flag is on only when PostHog says `true`: unknown, loading or a variant string is off. */
export function isFlagEnabled(value: boolean | string | undefined): boolean {
  return value === true;
}

/**
 * A PostHog flag, re-read each time the flags load. Always false while PostHog
 * is disabled (`ENV.posthog` is null on dev and preview builds, so there is no
 * client) — the same behaviour as iOS, where a flag-gated feature is simply
 * absent without PostHog.
 */
export function useFeatureFlag(key: string): boolean {
  const [isOn, setOn] = useState(() =>
    isFlagEnabled(getAnalyticsClient()?.getFeatureFlag(key)),
  );

  useEffect(() => {
    const client = getAnalyticsClient();
    if (client === null) return;
    const read = () => setOn(isFlagEnabled(client.getFeatureFlag(key)));
    read();
    return client.onFeatureFlags(read);
  }, [key]);

  return isOn;
}
