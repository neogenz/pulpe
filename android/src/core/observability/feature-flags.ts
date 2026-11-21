import { useEffect, useState } from "react";

import { ENV } from "@/core/config/env";

import { getAnalyticsClient } from "./analytics-client";

/** A flag is on only when PostHog says `true`: unknown, loading or a variant string is off. */
export function isFlagEnabled(value: boolean | string | undefined): boolean {
  return value === true;
}

/**
 * A PostHog flag, re-read each time the flags load. Always false while PostHog
 * is disabled (`ENV.posthog` is null on dev and preview builds, so there is no
 * client) — the same behaviour as iOS, where a flag-gated feature is simply
 * absent without PostHog. A local build can force a flag on through
 * `EXPO_PUBLIC_DEV_FEATURE_FLAGS`.
 */
export function useFeatureFlag(key: string): boolean {
  const isForced = ENV.devFeatureFlags.includes(key);
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

  return isForced || isOn;
}
