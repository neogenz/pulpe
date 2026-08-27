import { API_ERROR_CODES } from "pulpe-shared";

import { isApiError } from "@/core/api/api-error";

/**
 * The three ways the server says "the key this device is holding cannot open
 * this vault". The first is the one a PIN changed on another device produces:
 * the header is a perfectly well-formed 32 bytes, it simply no longer derives
 * the DEK, and the check fails at 400 rather than 403 — the other two are the
 * guard rejecting the header itself.
 */
const KEY_REJECTION_CODES: readonly string[] = [
  API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
  API_ERROR_CODES.AUTH_CLIENT_KEY_MISSING,
  API_ERROR_CODES.AUTH_CLIENT_KEY_INVALID,
];

export function isVaultKeyRejected(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.code !== undefined &&
    KEY_REJECTION_CODES.includes(error.code)
  );
}
