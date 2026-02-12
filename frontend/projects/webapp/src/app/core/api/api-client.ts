import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { type ZodType } from 'zod';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { normalizeApiError } from './api-error';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly #http = inject(HttpClient);
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

  get #baseUrl(): string {
    return this.#config.backendApiUrl();
  }

  get$<T>(path: string, schema: ZodType<T>): Observable<T> {
    return this.#http.get<unknown>(`${this.#baseUrl}${path}`).pipe(
      map((res) => schema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  post$<T>(path: string, body: unknown, schema: ZodType<T>): Observable<T> {
    return this.#http.post<unknown>(`${this.#baseUrl}${path}`, body).pipe(
      map((res) => schema.parse(res)),
      catchError((error) => this.#handleError(error)),
    );
  }

  patch$<T>(path: string, body: unknown, schema: ZodType<T>): Observable<T> {
    return this.#http.patch<unknown>(`${this.#baseUrl}${path}`, body).pipe(
      map((res) => schema.parse(res)),
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
   * POST for endpoints returning void (toggle, actions without response body)
   */
  postVoid$(path: string, body: unknown = {}): Observable<void> {
    return this.#http
      .post<void>(`${this.#baseUrl}${path}`, body)
      .pipe(catchError((error) => this.#handleError(error)));
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
