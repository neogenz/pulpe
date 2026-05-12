import { TestBed } from '@angular/core/testing';
import {
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { REQUEST_ID_HEADER } from 'pulpe-shared';
import { requestIdInterceptor } from './request-id-interceptor';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const runInterceptor = async (
  request: HttpRequest<unknown>,
): Promise<HttpRequest<unknown>> => {
  let captured!: HttpRequest<unknown>;
  const next: HttpHandlerFn = (req) => {
    captured = req;
    return of(new HttpResponse({ status: 200 }));
  };

  await TestBed.runInInjectionContext(() =>
    firstValueFrom(requestIdInterceptor(request, next)),
  );

  return captured;
};

describe('requestIdInterceptor', () => {
  it('should attach a UUID v4 X-Request-Id header to outgoing requests', async () => {
    const request = new HttpRequest('GET', '/api/test');

    const forwarded = await runInterceptor(request);

    const headerValue = forwarded.headers.get(REQUEST_ID_HEADER);
    expect(headerValue).toMatch(UUID_V4_PATTERN);
  });

  it('should generate a different id for each request', async () => {
    const firstRequest = new HttpRequest('GET', '/api/first');
    const secondRequest = new HttpRequest('GET', '/api/second');

    const firstForwarded = await runInterceptor(firstRequest);
    const secondForwarded = await runInterceptor(secondRequest);

    expect(firstForwarded.headers.get(REQUEST_ID_HEADER)).not.toBe(
      secondForwarded.headers.get(REQUEST_ID_HEADER),
    );
  });

  it('should preserve an existing X-Request-Id header set by upstream code', async () => {
    const existingId = 'caller-provided-id-abc';
    const request = new HttpRequest('GET', '/api/test', null, {
      headers: new HttpHeaders({ [REQUEST_ID_HEADER]: existingId }),
    });

    const forwarded = await runInterceptor(request);

    expect(forwarded.headers.get(REQUEST_ID_HEADER)).toBe(existingId);
  });
});
