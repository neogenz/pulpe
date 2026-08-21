import * as Application from "expo-application";
import type { User } from "@supabase/supabase-js";
import { useSegments } from "expo-router";
import { PostHog } from "posthog-react-native";
import { ANALYTICS_PROPERTIES, type AnalyticsEventName } from "pulpe-shared";
import { useEffect } from "react";

import { useSessionStore } from "@/core/auth/session-store";
import { ENV } from "@/core/config/env";
import { useLocaleStore } from "@/core/i18n/locale-store";

import {
  sanitizeProperties,
  type AnalyticsProperties,
} from "./analytics-properties";
import {
  isDiagnosticSharingEnabled,
  useDiagnosticsConsent,
} from "./diagnostics-consent";

let client: PostHog | null = null;
let identifiedUserId: string | null = null;
let identitySignature: string | null = null;

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
    locale: useLocaleStore.getState().locale,
  };
}

function identityProperties(user: User): AnalyticsProperties {
  return {
    [ANALYTICS_PROPERTIES.SUPABASE_USER_ID]: user.id,
    [ANALYTICS_PROPERTIES.EARLY_ADOPTER]:
      user.app_metadata?.early_adopter === true,
  };
}

function resetIdentity(): void {
  if (client === null || identifiedUserId === null) return;

  client.reset();
  void client.register(appContextProperties());
  identifiedUserId = null;
  identitySignature = null;
}

function syncIdentity(): void {
  if (client === null || !isDiagnosticSharingEnabled()) return;

  const { status, user } = useSessionStore.getState();
  if (status === "unauthenticated") {
    resetIdentity();
    return;
  }
  if (status !== "authenticated" || user === null) return;

  const properties = identityProperties(user);
  const signature = JSON.stringify(properties);
  if (identifiedUserId === user.id && identitySignature === signature) return;

  // Identifying B while A is still current aliases both accounts in PostHog.
  // Reset first so a shared device never merges two Pulpe users.
  if (identifiedUserId !== null && identifiedUserId !== user.id) {
    resetIdentity();
  }

  client.identify(user.id, properties);
  identifiedUserId = user.id;
  identitySignature = signature;
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
      // The SDK attaches Linking.getInitialURL() to "Application Opened". A
      // recovery App Link carries Supabase tokens in its fragment, so lifecycle
      // capture must stay off; our manual events already pass through the
      // property sanitizer below.
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
          nativeCrashes: false,
        },
      },
    });
    // Registered once so every manual event carries the same app identity.
    void client.register(appContextProperties());
  }

  syncIdentity();
  const stopSessionListening = useSessionStore.subscribe(syncIdentity);
  const stopLocaleListening = useLocaleStore.subscribe(() => {
    void client?.register(appContextProperties());
  });
  const stopConsentListening = useDiagnosticsConsent.subscribe((state) => {
    if (state.isDiagnosticSharingEnabled) {
      void client?.optIn();
      syncIdentity();
      return;
    }

    // reset() clears the SDK's persisted opt-out bit, so reset before optOut.
    resetIdentity();
    void client?.optOut();
  });

  return () => {
    stopSessionListening();
    stopLocaleListening();
    stopConsentListening();
  };
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
