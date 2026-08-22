import { API_ERROR_CODES } from "pulpe-shared";

import type { ApiErrorContext } from "@/core/api/api-client";
import { type ApiError, CLIENT_ERROR_CODES } from "@/core/api/api-error";

import { captureException } from "./analytics";
import type { AnalyticsProperties } from "./analytics-properties";

const IGNORED_STATUSES = new Set([401, 403, 429]);
const IGNORED_CODES = new Set<string>([
  CLIENT_ERROR_CODES.NETWORK_ERROR,
  CLIENT_ERROR_CODES.TIMEOUT,
  "MAINTENANCE",
  API_ERROR_CODES.RECOVERY_KEY_INVALID,
  API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED,
  API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function reportApiError(
  error: ApiError,
  context: ApiErrorContext,
): void {
  if (
    IGNORED_STATUSES.has(error.status) ||
    (error.code !== undefined && IGNORED_CODES.has(error.code))
  ) {
    return;
  }

  const properties: AnalyticsProperties = {
    http_method: context.method.toUpperCase(),
    http_status: error.status,
    request_path: anonymizePath(context.path),
    ...(error.code && { error_code: error.code }),
    ...(error.requestId && { request_id: error.requestId }),
  };
  const incident = new Error("API request failed");
  incident.name = "ApiRequestError";
  captureException(incident, properties);
}

function anonymizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0];
  const pathname = withoutQuery.startsWith("http")
    ? safePathname(withoutQuery)
    : withoutQuery;
  return pathname
    .split("/")
    .map((part) =>
      UUID.test(part) || /^\d+$/.test(part) || part.length > 40 ? ":id" : part,
    )
    .join("/");
}

function safePathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "/unknown";
  }
}
