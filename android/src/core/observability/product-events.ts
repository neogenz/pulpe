import { ANALYTICS_EVENTS } from "pulpe-shared";

import { AUTH_ISSUE_CODES } from "@/core/auth/auth-error";

import { captureEvent } from "./analytics-client";

/**
 * The cross-platform events that are one line at their call site, under the
 * property names and value spaces `AnalyticsEvent.swift` call sites use. None
 * carries an amount or a label.
 */

/** Same value space as `AuthErrorKind` on iOS, so a breakdown reads across apps. */
const AUTH_CODE_KINDS: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  over_email_send_rate_limit: "rateLimited",
  over_request_rate_limit: "rateLimited",
  email_not_confirmed: "emailNotConfirmed",
  user_not_found: "userNotFound",
  user_already_exists: "userAlreadyRegistered",
  email_exists: "userAlreadyRegistered",
  [AUTH_ISSUE_CODES.ACCOUNT_EXISTS]: "userAlreadyRegistered",
  weak_password: "weakPassword",
  same_password: "samePassword",
  session_expired: "sessionExpired",
  session_not_found: "sessionExpired",
  user_banned: "userBanned",
};

export function authErrorKind(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown";
  if ("code" in error && typeof error.code === "string") {
    const kind = AUTH_CODE_KINDS[error.code];
    if (kind !== undefined) return kind;
  }
  if ("name" in error && error.name === "AuthRetryableFetchError") {
    return "network";
  }
  return "unknown";
}

export type AuthMethod = "email" | "google";

/** `signup_redirect`: a signup attempt that turned out to be an existing account. */
export function captureLoginCompleted(
  method: AuthMethod,
  source?: "signup_redirect",
): void {
  captureEvent(
    ANALYTICS_EVENTS.LOGIN_COMPLETED,
    source === undefined ? { method } : { method, source },
  );
}

export function captureLoginFailed(method: AuthMethod, error: unknown): void {
  captureEvent(ANALYTICS_EVENTS.LOGIN_FAILED, {
    method,
    error_kind: authErrorKind(error),
  });
}

export function captureSignupStarted(method: AuthMethod): void {
  captureEvent(ANALYTICS_EVENTS.SIGNUP_STARTED, { method });
}

export function captureSignupFailed(method: AuthMethod, error: unknown): void {
  captureEvent(ANALYTICS_EVENTS.SIGNUP_FAILED, {
    method,
    error_kind: authErrorKind(error),
  });
}

export function captureLogoutCompleted(
  source: "user_initiated" | "system",
): void {
  captureEvent(ANALYTICS_EVENTS.LOGOUT_COMPLETED, { source });
}

export function capturePinEntered(): void {
  captureEvent(ANALYTICS_EVENTS.PIN_ENTERED);
}

export function capturePinChanged(): void {
  captureEvent(ANALYTICS_EVENTS.PIN_CHANGED);
}

export function captureRecoveryKeyAcknowledged(): void {
  captureEvent(ANALYTICS_EVENTS.RECOVERY_KEY_ACKNOWLEDGED);
}

export function captureOnboardingHandoffCompleted(): void {
  // Android has no widget to ask about; the property keeps the iOS shape.
  captureEvent(ANALYTICS_EVENTS.ONBOARDING_HANDOFF_COMPLETED, {
    widget_help_opened: false,
  });
}

export function captureCurrencyChanged(from: string, to: string): void {
  captureEvent(ANALYTICS_EVENTS.CURRENCY_CHANGED, { from, to });
}

export function captureReminderToggled(
  reminder: "monthly" | "weekly_recap",
  enabled: boolean,
): void {
  captureEvent(ANALYTICS_EVENTS.REMINDER_TOGGLED, { enabled, reminder });
}

/** For the tabs layout. `tab` is the route name, never a label. */
export function captureTabSwitched(tab: string): void {
  captureEvent(ANALYTICS_EVENTS.TAB_SWITCHED, { tab });
}

export type EntryType = "income" | "expense" | "saving";

export function captureBudgetCreated(): void {
  captureEvent(ANALYTICS_EVENTS.BUDGET_CREATED);
}

export function captureTransactionCreated(type: EntryType): void {
  captureEvent(ANALYTICS_EVENTS.TRANSACTION_CREATED, { type });
}
