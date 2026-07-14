import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { defer, type Observable, throwError, timer } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { type ZodType } from 'zod';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { normalizeApiError } from './api-error';

/** Base backoff for transient GET retries — tests collapse it to 0. */
export const API_RETRY_BASE_DELAY_MS = new InjectionToken<number>(
  'API_RETRY_BASE_DELAY_MS',
  { factory: () => 400 },
);

const TRANSIENT_RETRY_COUNT = 2;

/** Self-healing failures: network blip, 5xx, timeout, rate-limit. */
function isTransientError(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 ||
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 429)
  );
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly #http = inject(HttpClient);
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #retryBaseDelayMs = inject(API_RETRY_BASE_DELAY_MS);

  get #baseUrl(): string {
    return this.#config.backendApiUrl();
  }

  get$<T>(path: string, schema: ZodType<T>): Observable<T> {
    return this.#http.get<unknown>(`${this.#baseUrl}${path}`).pipe(
      this.#retryTransient<unknown>(),
      map((res) => schema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  /**
   * Reads are idempotent — absorb transient failures with a short backoff
   * (400ms, 1.2s) instead of surfacing an error screen for a condition the
   * next attempt resolves. Mutations are NEVER replayed here.
   */
  #retryTransient<T>() {
    return retry<T>({
      count: TRANSIENT_RETRY_COUNT,
      delay: (error, retryCount) => {
        if (!isTransientError(error)) return throwError(() => error);
        return timer(this.#retryBaseDelayMs * 3 ** (retryCount - 1));
      },
    });
  }

  post$<TRes, TReq = unknown>(
    path: string,
    body: TReq,
    responseSchema: ZodType<TRes>,
    requestSchema?: ZodType<TReq>,
  ): Observable<TRes> {
    return defer(() => {
      const payload = requestSchema ? requestSchema.parse(body) : body;
      return this.#http.post<unknown>(`${this.#baseUrl}${path}`, payload);
    }).pipe(
      map((res) => responseSchema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  patch$<TRes, TReq = unknown>(
    path: string,
    body: TReq,
    responseSchema: ZodType<TRes>,
    requestSchema?: ZodType<TReq>,
  ): Observable<TRes> {
    return defer(() => {
      const payload = requestSchema ? requestSchema.parse(body) : body;
      return this.#http.patch<unknown>(`${this.#baseUrl}${path}`, payload);
    }).pipe(
      map((res) => responseSchema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  put$<TRes, TReq = unknown>(
    path: string,
    body: TReq,
    responseSchema: ZodType<TRes>,
    requestSchema?: ZodType<TReq>,
  ): Observable<TRes> {
    return defer(() => {
      const payload = requestSchema ? requestSchema.parse(body) : body;
      return this.#http.put<unknown>(`${this.#baseUrl}${path}`, payload);
    }).pipe(
      map((res) => responseSchema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  delete$<T>(path: string, schema: ZodType<T>): Observable<T> {
    return this.#http.delete<unknown>(`${this.#baseUrl}${path}`).pipe(
      map((res) => schema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  /**
   * DELETE for endpoints returning 204 with no body (AC-1.3)
   */
  deleteVoid$(path: string): Observable<void> {
    return this.#http
      .delete<void>(`${this.#baseUrl}${path}`)
      .pipe(catchError((error) => this.#handleError(error)));
  }

  /**
   * POST for endpoints returning void (toggle, actions without response body).
   * Pass `requestSchema` to validate the body before sending.
   */
  postVoid$<TReq = unknown>(
    path: string,
    body: TReq = {} as TReq,
    requestSchema?: ZodType<TReq>,
  ): Observable<void> {
    return defer(() => {
      const payload = requestSchema ? requestSchema.parse(body) : body;
      return this.#http.post<void>(`${this.#baseUrl}${path}`, payload);
    }).pipe(catchError((error) => this.#handleError(error)));
  }

  #handleError(error: unknown): Observable<never> {
    const apiError = normalizeApiError(error);
    this.#logger.error(`[ApiClient] ${apiError.message}`, {
      code: apiError.code,
      status: apiError.status,
    });
    return throwError(() => apiError);
  }
}
