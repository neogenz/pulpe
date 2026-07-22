import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { API_RETRY_BASE_DELAY_MS, ApiClient } from './api-client';
import { ApiError } from './api-error';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';

/**
 * Runs against the REAL backend that `provideHttpClient()` installs — no
 * `provideHttpClientTesting()`, which would replace it. Angular 22 made `fetch`
 * that default, and its failure objects differ from XHR's: a dropped connection
 * surfaces as a `TypeError` instead of a `ProgressEvent`, and a malformed body
 * on a 2xx as a bare `SyntaxError`. `ApiClient` reads `HttpErrorResponse.status`
 * to decide what is transient, so these tests pin the mapping the rest of the
 * app depends on.
 */

const TEST_BASE_URL = 'http://localhost:3000/api/v1';

const testSchema = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string() }),
});

const mockConfig = {
  backendApiUrl: vi.fn().mockReturnValue(TEST_BASE_URL),
};

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      ApiClient,
      { provide: ApplicationConfiguration, useValue: mockConfig },
      { provide: Logger, useValue: mockLogger },
      { provide: API_RETRY_BASE_DELAY_MS, useValue: 0 },
    ],
  });

  return TestBed.inject(ApiClient);
}

describe('ApiClient over the fetch backend', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should retry a GET twice when the connection drops', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = setup();

    const error = await firstValueFrom(
      client.get$('/budgets', testSchema),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it('should surface a business error without retrying', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = setup();

    const error = await firstValueFrom(
      client.get$('/budgets', testSchema),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('should reject a malformed body on a 2xx instead of parsing it as success', async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"success": tru', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = setup();

    const error = await firstValueFrom(
      client.get$('/budgets', testSchema),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
  });

  it('should preserve a 401 so the auth interceptor can refresh the session', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = setup();

    const error = await firstValueFrom(
      client.get$('/budgets', testSchema),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((error as ApiError).status).toBe(401);
  });
});
