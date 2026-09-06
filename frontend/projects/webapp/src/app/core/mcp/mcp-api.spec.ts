import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpApi } from './mcp-api';

const baseUrl = 'http://localhost:3000/api/v1';

describe('McpApi', () => {
  let api: McpApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => baseUrl },
        },
      ],
    });
    api = TestBed.inject(McpApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('encodes connection ids and rejects limits outside the shared contract', async () => {
    expect(() => api.getActivity$('id', 101)).toThrow();
    const result = firstValueFrom(api.getActivity$('id/?#', 5));
    http
      .expectOne(`${baseUrl}/mcp/connections/id%2F%3F%23/activity?limit=5`)
      .flush({ success: true, data: [] });
    expect(await result).toEqual([]);
    const revoked = firstValueFrom(api.revoke$('id/?#'));
    const request = http.expectOne(`${baseUrl}/mcp/connections/id%2F%3F%23`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await revoked;
  });

  it('keeps the vault key on the approval request only and never caches consent', async () => {
    const approval = firstValueFrom(
      api.approve$('auth/?#', 'read', 'ab'.repeat(32)),
    );
    const request = http.expectOne(
      `${baseUrl}/mcp/consent/auth%2F%3F%23/approve`,
    );
    expect(request.request.headers.get('X-Client-Key')).toBe('ab'.repeat(32));
    expect(request.request.body).toEqual({ mode: 'read' });
    request.flush({ redirectUrl: 'https://client.test/callback' });
    await approval;
    const denied = firstValueFrom(api.deny$('auth/?#'));
    const denial = http.expectOne(`${baseUrl}/mcp/consent/auth%2F%3F%23/deny`);
    expect(denial.request.headers.has('X-Client-Key')).toBe(false);
    denial.flush({
      redirectUrl: 'https://client.test/callback?error=access_denied',
    });
    await denied;
    expect(api.cache.inspect().size).toBe(0);
  });

  it('clears connection metadata between authenticated sessions', () => {
    api.cache.set(['connections'], [{ clientName: 'Previous owner' }]);
    api.clearCache();
    expect(api.cache.get(['connections'])).toBeNull();
  });
});
