import { errorResponseSchema } from "pulpe-shared";
import { ZodError } from "zod";

export const CLIENT_ERROR_CODES = {
  ZOD_PARSE_ERROR: "ZOD_PARSE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
} as const;

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

/**
 * Status 0 means no HTTP response was ever received — offline, DNS failure,
 * aborted request. The web client uses the same convention.
 */
export const NO_HTTP_RESPONSE_STATUS = 0;

/**
 * The backend describes its own failures, so its message is shown as-is, like
 * on web and iOS. These cover only the failures the server never sees, which
 * on web are worded by Transloco and have no equivalent here.
 */
const CLIENT_ERROR_MESSAGES_FR = {
  network: "Connexion impossible. Vérifie ta connexion et réessaie.",
  timeout: "Le serveur met trop de temps à répondre. Réessaie dans un instant.",
  invalidResponse: "Réponse inattendue du serveur. Réessaie dans un instant.",
  unknown: "Une erreur est survenue. Réessaie dans un instant.",
} as const;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
    readonly details: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Self-healing failures: network blip, 5xx, timeout, rate limit. Mirrors
 * `isTransientError` in the web `ApiClient`.
 *
 * Status 0 alone is not enough to decide. It covers both "no response ever
 * arrived", which the next attempt may well resolve, and "a response arrived
 * but failed its schema", which is a contract bug that replaying only repeats.
 * The web keeps the same two apart — see `.claude/rules/05-workflows-and-processes/error-handling.md`.
 */
export function isTransientError(error: unknown): boolean {
  if (!isApiError(error)) return false;

  if (error.status === NO_HTTP_RESPONSE_STATUS) {
    return (
      error.code === CLIENT_ERROR_CODES.NETWORK_ERROR ||
      error.code === CLIENT_ERROR_CODES.TIMEOUT
    );
  }

  return error.status >= 500 || error.status === 408 || error.status === 429;
}

/** Builds the error carried by a response the server did answer. */
export function apiErrorFromResponse(
  status: number,
  body: unknown,
  requestId?: string,
): ApiError {
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(
      parsed.data.message ?? parsed.data.error,
      parsed.data.code,
      status,
      parsed.data.details,
      requestId,
    );
  }

  const message =
    typeof body === "string" && body.length > 0
      ? body
      : CLIENT_ERROR_MESSAGES_FR.unknown;
  return new ApiError(message, undefined, status, body, requestId);
}

/** Builds the error carried by a failure that never reached the server. */
export function normalizeApiError(
  error: unknown,
  requestId?: string,
): ApiError {
  if (isApiError(error)) return error;

  if (error instanceof ZodError) {
    return new ApiError(
      CLIENT_ERROR_MESSAGES_FR.invalidResponse,
      CLIENT_ERROR_CODES.ZOD_PARSE_ERROR,
      NO_HTTP_RESPONSE_STATUS,
      error.issues,
      requestId,
    );
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ApiError(
      CLIENT_ERROR_MESSAGES_FR.timeout,
      CLIENT_ERROR_CODES.TIMEOUT,
      NO_HTTP_RESPONSE_STATUS,
      undefined,
      requestId,
    );
  }

  if (error instanceof Error) {
    return new ApiError(
      CLIENT_ERROR_MESSAGES_FR.network,
      CLIENT_ERROR_CODES.NETWORK_ERROR,
      NO_HTTP_RESPONSE_STATUS,
      error.message,
      requestId,
    );
  }

  return new ApiError(
    CLIENT_ERROR_MESSAGES_FR.unknown,
    undefined,
    NO_HTTP_RESPONSE_STATUS,
    error,
    requestId,
  );
}
