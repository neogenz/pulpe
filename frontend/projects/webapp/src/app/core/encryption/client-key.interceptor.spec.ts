import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { ApplicationConfiguration } from '@core/config/application-configuration';

import { ClientKeyService } from './client-key.service';
import { clientKeyInterceptor } from './client-key.interceptor';

describe('clientKeyInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let clientKeyService: ClientKeyService;

  const backendApiUrl = 'http://localhost:3000/api';
  const validKeyHex = 'a'.repeat(64);

  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockReturnValue(undefined);
    removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockReturnValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([clientKeyInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => backendApiUrl },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    clientKeyService = TestBed.inject(ClientKeyService);
  });

  afterEach(() => {
    httpTesting.verify();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('should add X-Client-Key header to backend requests when key exists', () => {
    getItemSpy.mockReturnValue(validKeyHex);
    clientKeyService.initialize();

    http.get(`${backendApiUrl}/users`).subscribe();

    const req = httpTesting.expectOne(`${backendApiUrl}/users`);
    expect(req.request.headers.get('X-Client-Key')).toBe(validKeyHex);
    req.flush([]);
  });

  it('should not add header when no client key is set', () => {
    http.get(`${backendApiUrl}/users`).subscribe();

    const req = httpTesting.expectOne(`${backendApiUrl}/users`);
    expect(req.request.headers.has('X-Client-Key')).toBe(false);
    req.flush([]);
  });

  it('should not add header for non-backend URLs', () => {
    getItemSpy.mockReturnValue(validKeyHex);
    clientKeyService.initialize();

    http.get('https://external-api.com/data').subscribe();

    const req = httpTesting.expectOne('https://external-api.com/data');
    expect(req.request.headers.has('X-Client-Key')).toBe(false);
    req.flush([]);
  });

  it('should not override an existing X-Client-Key header', () => {
    getItemSpy.mockReturnValue(validKeyHex);
    clientKeyService.initialize();

    const existingKey = 'b'.repeat(64);
    http
      .get(`${backendApiUrl}/salt`, {
        headers: { 'X-Client-Key': existingKey },
      })
      .subscribe();

    const req = httpTesting.expectOne(`${backendApiUrl}/salt`);
    expect(req.request.headers.get('X-Client-Key')).toBe(existingKey);
    req.flush({});
  });

  it('should stop adding header after client key is cleared', () => {
    getItemSpy.mockReturnValue(validKeyHex);
    clientKeyService.initialize();
    clientKeyService.clear();

    http.get(`${backendApiUrl}/users`).subscribe();

    const req = httpTesting.expectOne(`${backendApiUrl}/users`);
    expect(req.request.headers.has('X-Client-Key')).toBe(false);
    req.flush([]);
  });
});
