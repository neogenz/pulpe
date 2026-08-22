import { REQUEST_ID_HEADER } from "pulpe-shared";
import type { ZodType } from "zod";

import {
  ApiError,
  apiErrorFromResponse,
  isTransientError,
  normalizeApiError,
  NO_HTTP_RESPONSE_STATUS,
} from "./api-error";

/** Header carrying the vault client key. Injected once the vault is unlocked. */
export const CLIENT_KEY_HEADER = "X-Client-Key";

const TRANSIENT_RETRY_COUNT = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_TIMEOUT_MS = 30_000;
const HTTP_NO_CONTENT = 204;

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Supabase access token, or null while signed out. */
  getAccessToken: () => string | null | Promise<string | null>;
  /** Vault client key, or null while the vault is locked. */
  getClientKey: () => string | null;
  retryBaseDelayMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface RequestOptions<TBody> {
  query?: QueryParams;
  body?: TBody;
  requestSchema?: ZodType<TBody>;
}

/**
 * Correlation id only — it lands in Pino logs and PostHog events, never in a
 * security decision, so a non-cryptographic source is enough and keeps this
 * free of a native dependency.
 */
function generateRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Functional mirror of `APIClient.swift` and the web `ApiClient`: every
 * response is parsed by a `pulpe-shared` schema, every mutation body may be
 * validated before it leaves, and only reads are ever replayed.
 */
export class ApiClient {
  readonly #baseUrl: string;
  readonly #getAccessToken: ApiClientOptions["getAccessToken"];
  readonly #getClientKey: ApiClientOptions["getClientKey"];
  readonly #retryBaseDelayMs: number;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#getAccessToken = options.getAccessToken;
    this.#getClientKey = options.getClientKey;
    this.#retryBaseDelayMs =
      options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#fetch = options.fetchFn ?? fetch;
  }

  /**
   * Reads are idempotent, so a transient failure is absorbed with a short
   * backoff instead of surfacing an error screen for something the next
   * attempt resolves. Mutations are NEVER replayed.
   */
  async get<T>(
    path: string,
    schema: ZodType<T>,
    query?: QueryParams,
  ): Promise<T> {
    let lastError: ApiError | undefined;

    for (let attempt = 0; attempt <= TRANSIENT_RETRY_COUNT; attempt += 1) {
      try {
        return await this.#request("GET", path, schema, { query });
      } catch (error) {
        lastError = normalizeApiError(error);
        if (!isTransientError(lastError)) throw lastError;
        if (attempt === TRANSIENT_RETRY_COUNT) break;
        await delay(this.#retryBaseDelayMs * 3 ** attempt);
      }
    }

    throw lastError;
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    responseSchema: ZodType<TResponse>,
    requestSchema?: ZodType<TBody>,
  ): Promise<TResponse> {
    return this.#request("POST", path, responseSchema, { body, requestSchema });
  }

  patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    responseSchema: ZodType<TResponse>,
    requestSchema?: ZodType<TBody>,
  ): Promise<TResponse> {
    return this.#request("PATCH", path, responseSchema, {
      body,
      requestSchema,
    });
  }

  put<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    responseSchema: ZodType<TResponse>,
    requestSchema?: ZodType<TBody>,
  ): Promise<TResponse> {
    return this.#request("PUT", path, responseSchema, { body, requestSchema });
  }

  delete<T>(path: string, schema: ZodType<T>, query?: QueryParams): Promise<T> {
    return this.#request("DELETE", path, schema, { query });
  }

  /** For endpoints answering 204 with no body. */
  async deleteVoid(path: string, query?: QueryParams): Promise<void> {
    await this.#request("DELETE", path, undefined, { query });
  }

  /** For toggles and actions answering without a body. */
  async postVoid<TBody = unknown>(
    path: string,
    body?: TBody,
    requestSchema?: ZodType<TBody>,
  ): Promise<void> {
    await this.#request("POST", path, undefined, { body, requestSchema });
  }

  async #request<T, TBody>(
    method: string,
    path: string,
    schema: ZodType<T> | undefined,
    options: RequestOptions<TBody> = {},
  ): Promise<T> {
    const { body, requestSchema, query } = options;
    const payload =
      requestSchema && body !== undefined ? requestSchema.parse(body) : body;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    let response: Response;
    try {
      response = await this.#fetch(this.#buildUrl(path, query), {
        method,
        headers: await this.#buildHeaders(payload !== undefined),
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      throw normalizeApiError(error);
    } finally {
      clearTimeout(timeout);
    }

    return this.#parseResponse(response, schema);
  }

  async #parseResponse<T>(
    response: Response,
    schema: ZodType<T> | undefined,
  ): Promise<T> {
    const rawBody = await response.text();
    const parsedBody = this.#parseJson(rawBody);

    if (!response.ok) {
      throw apiErrorFromResponse(response.status, parsedBody ?? rawBody);
    }

    if (!schema) return undefined as T;

    if (response.status === HTTP_NO_CONTENT || rawBody.length === 0) {
      throw new ApiError(
        "Le serveur a répondu sans contenu alors qu'une réponse était attendue.",
        undefined,
        response.status,
        undefined,
      );
    }

    const validated = schema.safeParse(parsedBody);
    if (!validated.success) throw normalizeApiError(validated.error);
    return validated.data;
  }

  #parseJson(raw: string): unknown {
    if (raw.length === 0) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  #buildUrl(path: string, query?: QueryParams): string {
    const url = `${this.#baseUrl}${path}`;
    if (!query) return url;

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.append(key, String(value));
    }
    const queryString = search.toString();
    return queryString.length > 0 ? `${url}?${queryString}` : url;
  }

  async #buildHeaders(hasBody: boolean): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      [REQUEST_ID_HEADER]: generateRequestId(),
    };

    if (hasBody) headers["Content-Type"] = "application/json";

    const accessToken = await this.#getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const clientKey = this.#getClientKey();
    if (clientKey) headers[CLIENT_KEY_HEADER] = clientKey;

    return headers;
  }
}

export { NO_HTTP_RESPONSE_STATUS };
