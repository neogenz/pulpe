import { useSegments } from "expo-router";
import { PostHog } from "posthog-react-native";
import { useEffect } from "react";

import { ENV } from "@/core/config/env";

import {
  isDiagnosticSharingEnabled,
  useDiagnosticsConsent,
} from "./diagnostics-consent";

let client: PostHog | null = null;

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
  client ??= new PostHog(config.apiKey, {
    host: config.host,
    // Read before the SDK captures anything of its own, so a refusal made on a
    // previous run holds from the very first lifecycle event rather than from
    // the moment the subscription below first fires.
    defaultOptIn: isDiagnosticSharingEnabled(),
    enableSessionReplay: false,
  });

  return useDiagnosticsConsent.subscribe((state) => {
    void (state.isDiagnosticSharingEnabled
      ? client?.optIn()
      : client?.optOut());
  });
}

/**
 * The only capture the app makes, and it carries the *file* segments of the
 * route rather than the resolved path: `budget/[id]/line/[lineId]`, never the
 * ids themselves. Nothing financial reaches PostHog by construction — there is
 * no code path that puts an amount on an event.
 */
export function useScreenTracking(): void {
  const screen = useSegments().join("/");

  useEffect(() => {
    if (screen === "") return;
    void client?.screen(screen);
  }, [screen]);
}
