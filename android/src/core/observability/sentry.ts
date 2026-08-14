import * as Sentry from "@sentry/react-native";

import { ENV } from "@/core/config/env";

import { isDiagnosticSharingEnabled } from "./diagnostics-consent";

/**
 * Crash reporting. Inert until a human creates the Sentry project — no profile
 * carries a DSN yet — and inert in development, where the red box already says
 * more than any event would.
 *
 * Call it at module scope, before the first component renders: an error thrown
 * on the way up is exactly the one worth having. Answers whether it armed
 * anything, so the caller knows whether `Sentry.wrap` has a client to talk to.
 */
export function startSentry(): boolean {
  // Both gates earn their keep: refusing here means a run that shares nothing
  // never even opens a session, and the `beforeSend` below makes a refusal
  // made mid-run take effect without waiting for a relaunch.
  if (ENV.sentryDsn === null || __DEV__ || !isDiagnosticSharingEnabled()) {
    return false;
  }

  Sentry.init({
    dsn: ENV.sentryDsn,
    environment: ENV.environment,
    sendDefaultPii: false,
    beforeSend: (event) => {
      if (!isDiagnosticSharingEnabled()) return null;

      // The bearer token and the vault key both travel as headers, and no
      // crash was ever explained by either.
      delete event.request?.headers;
      delete event.request?.cookies;
      delete event.request?.data;
      // Everything the app attaches by hand lands in `extra` — including the
      // amounts it has already formatted for the screen.
      delete event.extra;

      return event;
    },
    // Console breadcrumbs replay whatever the app logged, which is where a
    // formatted amount is most likely to end up.
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === "console" ? null : breadcrumb,
  });

  return true;
}
