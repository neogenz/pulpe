import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { authInterceptor, resetRefreshState } from './auth-interceptor';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { ClientKeyService } from '../encryption';
import { ApplicationConfiguration } from '../config/application-configuration';

// Test simple de la fonction shouldInterceptRequest
function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  return url.startsWith(backendApiUrl);
}

describe('shouldInterceptRequest', () => {
  it('should return true for backend URLs', () => {
    const backendUrl = 'https://api.pulpe.ch';

    expect(
      shouldInterceptRequest('https://api.pulpe.ch/users', backendUrl),
    ).toBe(true);
    expect(
      shouldInterceptRequest('https://api.pulpe.ch/auth/login', backendUrl),
    ).toBe(true);
    expect(shouldInterceptRequest('https://api.pulpe.ch', backendUrl)).toBe(
      true,
    );
  });

  it('should return false for non-backend URLs', () => {
    const backendUrl = 'https://api.pulpe.ch';

    expect(
      shouldInterceptRequest('https://external-api.com/data', backendUrl),
    ).toBe(false);
    expect(shouldInterceptRequest('https://google.com', backendUrl)).toBe(
      false,
    );
    expect(shouldInterceptRequest('http://localhost:3000', backendUrl)).toBe(
      false,
    );
  });

  it('should handle different backend URL formats', () => {
    expect(
      shouldInterceptRequest(
        'https://api.pulpe.ch/users',
        'https://api.pulpe.ch',
      ),
    ).toBe(true);
    expect(
      shouldInterceptRequest(
        'http://localhost:8080/api/users',
        'http://localhost:8080/api',
      ),
    ).toBe(true);
    expect(
      shouldInterceptRequest(
        'https://api.pulpe.ch/users',
        'http://api.pulpe.ch',
      ),
    ).toBe(false);
  });
});

describe('authInterceptor - concurrent 401 refresh lock', () => {
  const BACKEND_URL = 'https://api.pulpe.ch';

  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let mockAuthSession: {
    getCurrentSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let mockAuthState: { isAuthenticated: ReturnType<typeof vi.fn> };
  let refreshResolvers: ((value: boolean) => void)[];

  beforeEach(() => {
    resetRefreshState();
    refreshResolvers = [];

    mockAuthSession = {
      getCurrentSession: vi
        .fn()
        .mockResolvedValue({ access_token: 'valid-token' }),
      refreshSession: vi.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            refreshResolvers.push(resolve);
          }),
      ),
      signOut: vi.fn(),
    };

    mockAuthState = {
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    const mockApplicationConfig = {
      backendApiUrl: vi.fn().mockReturnValue(BACKEND_URL),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: ClientKeyService, useValue: { clear: vi.fn() } },
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  // Flush microtasks so the async addAuthToken pipeline resolves
  async function flushMicrotasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('should only call refreshSession once for concurrent 401 responses', async () => {
    // Fire two requests simultaneously
    const promise1 = firstValueFrom(http.get(`${BACKEND_URL}/endpoint1`)).catch(
      () => 'failed',
    );
    const promise2 = firstValueFrom(http.get(`${BACKEND_URL}/endpoint2`)).catch(
      () => 'failed',
    );

    // Let async interceptor pipeline (addAuthToken) resolve
    await flushMicrotasks();

    // Both requests return 401
    const req1 = httpTesting.expectOne(`${BACKEND_URL}/endpoint1`);
    const req2 = httpTesting.expectOne(`${BACKEND_URL}/endpoint2`);
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    // Wait for the 401 handler to call refreshSession
    await vi.waitFor(() => {
      expect(refreshResolvers.length).toBeGreaterThanOrEqual(1);
    });

    // Only ONE refresh should have been initiated
    expect(mockAuthSession.refreshSession).toHaveBeenCalledTimes(1);

    // Resolve the refresh
    refreshResolvers[0](true);

    // Let retry's addAuthToken resolve
    await flushMicrotasks();

    // Complete retried requests
    const retries = httpTesting.match(() => true);
    retries.forEach((r) => r.flush({ data: 'ok' }));

    await Promise.all([promise1, promise2]);
  });

  it('should redirect all waiting requests to login when refresh fails', async () => {
    const promise1 = firstValueFrom(http.get(`${BACKEND_URL}/endpoint1`)).catch(
      (err) => err,
    );
    const promise2 = firstValueFrom(http.get(`${BACKEND_URL}/endpoint2`)).catch(
      (err) => err,
    );

    // Let async interceptor pipeline resolve
    await flushMicrotasks();

    const req1 = httpTesting.expectOne(`${BACKEND_URL}/endpoint1`);
    const req2 = httpTesting.expectOne(`${BACKEND_URL}/endpoint2`);
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => {
      expect(refreshResolvers.length).toBeGreaterThanOrEqual(1);
    });

    // Refresh fails
    refreshResolvers[0](false);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both should have errored
    expect(result1).toBeInstanceOf(Error);
    expect(result2).toBeInstanceOf(Error);

    // Only one refresh call
    expect(mockAuthSession.refreshSession).toHaveBeenCalledTimes(1);
  });
});
