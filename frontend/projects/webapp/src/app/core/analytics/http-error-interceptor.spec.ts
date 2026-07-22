import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { REQUEST_ID_HEADER } from 'pulpe-shared';

import { PostHogService } from './posthog';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { httpErrorInterceptor } from './http-error-interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let captureException: ReturnType<typeof vi.fn>;

  const url = 'http://localhost:3000/api/test';

  beforeEach(() => {
    captureException = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: PostHogService, useValue: { captureException } },
        { provide: Logger, useValue: { debug: vi.fn(), warn: vi.fn() } },
        {
          provide: ApplicationConfiguration,
          useValue: { isDevelopment: () => false },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should attach request_id to PostHog context when the X-Request-Id header is present', () => {
    const requestId = 'feedf00d-dead-beef-cafe-1234567890ab';
    const headers = new HttpHeaders({ [REQUEST_ID_HEADER]: requestId });

    http.get(url, { headers }).subscribe({ error: () => undefined });
    const req = httpTesting.expectOne(url);
    req.flush(
      { code: 'ERR_X', message: 'boom' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(captureException).toHaveBeenCalledOnce();
    const context = captureException.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(context['request_id']).toBe(requestId);
  });

  it('should omit request_id from PostHog context when the X-Request-Id header is missing', () => {
    http.get(url).subscribe({ error: () => undefined });
    const req = httpTesting.expectOne(url);
    req.flush({ code: 'ERR_Y' }, { status: 500, statusText: 'Server Error' });

    expect(captureException).toHaveBeenCalledOnce();
    const context = captureException.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(context).not.toHaveProperty('request_id');
  });

  it('should not capture 401 errors (handled by authInterceptor)', () => {
    const headers = new HttpHeaders({ [REQUEST_ID_HEADER]: 'any-id' });

    http.get(url, { headers }).subscribe({ error: () => undefined });
    const req = httpTesting.expectOne(url);
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(captureException).not.toHaveBeenCalled();
  });

  it('should not capture 403 errors (handled by authInterceptor)', () => {
    http.get(url).subscribe({ error: () => undefined });
    const req = httpTesting.expectOne(url);
    req.flush({}, { status: 403, statusText: 'Forbidden' });

    expect(captureException).not.toHaveBeenCalled();
  });

  it('should preserve request_id end-to-end including backend payload details', () => {
    const requestId = 'abc-correlation-id-123';
    const headers = new HttpHeaders({ [REQUEST_ID_HEADER]: requestId });
    const backendPayload = {
      success: false,
      code: 'ERR_BUDGET_NOT_FOUND',
      message: 'Budget not found',
      statusCode: 404,
      error: 'BusinessException',
    };

    http.get(url, { headers }).subscribe({ error: () => undefined });
    const req = httpTesting.expectOne(url);
    req.flush(backendPayload, { status: 404, statusText: 'Not Found' });

    expect(captureException).toHaveBeenCalledOnce();
    const context = captureException.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(context['request_id']).toBe(requestId);
    expect(context['backendErrorCode']).toBe('ERR_BUDGET_NOT_FOUND');
    expect(context['httpStatus']).toBe(404);
  });
});
