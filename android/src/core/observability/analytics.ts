import * as Application from "expo-application";
import { useSegments } from "expo-router";
import { PostHog } from "posthog-react-native";
import type { AnalyticsEventName } from "pulpe-shared";
import { useEffect } from "react";

import { ENV } from "@/core/config/env";

import {
  sanitizeProperties,
  type AnalyticsProperties,
} from "./analytics-properties";
import {
  isDiagnosticSharingEnabled,
  useDiagnosticsConsent,
} from "./diagnostics-consent";

let client: PostHog | null = null;

/**
 * Which app is reporting, on every event. Without it an Android event is
 * indistinguishable from an iOS or a web one in PostHog, and neither the funnel
 * nor a crash report can be read per platform or per release.
 *
 * Mirrors `AnalyticsService.appContextProperties` key for key, so a dashboard
 * breakdown works across both apps.
 */
function appContextProperties(): AnalyticsProperties {
  return {
    platform: "android",
    environment: ENV.environment,
    app_version: Application.nativeApplicationVersion ?? "unknown",
    build_number: Application.nativeBuildVersion ?? "unknown",
  };
}

/**
 * Measurement is production-only — `ENV.posthog` is null on every other
 * profile, so a local or preview build never opens a socket to PostHog at all,
 * exactly as on iOS.
 *
 * Returns the teardown for the consent subscription, which is what the root
 * layout's effect expects.
 */
export function startAnalytics(): () => void {
  const config = ENV.posthog;
  if (config === null) return () => undefined;

  // The client is built once and kept; the subscription is not. Bailing out
  // early on both together left a remount — which is every Fast Refresh of the
  // root layout — with a live client nothing was watching, so a consent
  // withdrawn after it never reached PostHog.
  if (client === null) {
    client = new PostHog(config.apiKey, {
      host: config.host,
      // Read before the SDK captures anything of its own, so a refusal made on a
      // previous run holds from the very first lifecycle event rather than from
      // the moment the subscription below first fires.
      defaultOptIn: isDiagnosticSharingEnabled(),
      enableSessionReplay: false,
    });
    // Registered with the client rather than added at each call site: a super
    // property reaches the SDK's own lifecycle events too, which no caller here
    // ever sees.
    void client.register(appContextProperties());
  }

  return useDiagnosticsConsent.subscribe((state) => {
    void (state.isDiagnosticSharingEnabled
      ? client?.optIn()
      : client?.optOut());
  });
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

/**
 * Screen views, carrying the *file* segments of the route rather than the
 * resolved path: `budget/[id]/line/[lineId]`, never the ids themselves.
 */
export function useScreenTracking(): void {
  const screen = useSegments().join("/");

  useEffect(() => {
    if (screen === "") return;
    void client?.screen(screen);
  }, [screen]);
}
