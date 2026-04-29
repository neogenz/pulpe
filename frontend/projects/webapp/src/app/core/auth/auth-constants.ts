import { type ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;
export const VAULT_CODE_LENGTH = 4;

export const VAULT_CODE_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(VAULT_CODE_LENGTH),
  Validators.maxLength(VAULT_CODE_LENGTH),
  Validators.pattern(/^\d+$/),
];

export const SCHEDULED_DELETION_PARAMS = {
  REASON: 'reason',
  REASON_VALUE: 'scheduled-deletion',
  DATE: 'date',
} as const;

export const AUTH_ERROR_KEYS = {
  OAUTH_CONNECTION_ERROR: 'auth.errors.oauthConnection',
  UNEXPECTED_LOGIN_ERROR: 'auth.errors.unexpectedLogin',
  UNEXPECTED_SIGNUP_ERROR: 'auth.errors.unexpectedSignup',
  UNEXPECTED_SESSION_ERROR: 'auth.errors.unexpectedSession',
  SESSION_EXPIRED: 'auth.errors.sessionExpired',
  REFRESH_FAILED: 'auth.errors.refreshFailed',
  ACCOUNT_BLOCKED: 'auth.errors.accountBlocked',
  CLIENT_KEY_MISSING: 'auth.errors.clientKeyMissing',
} as const;

export function formatDeletionDate(
  scheduledDeletionAt: unknown,
  locale: string,
): string {
  const date = new Date(String(scheduledDeletionAt));
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale);
}
