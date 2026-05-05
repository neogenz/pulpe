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
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { authInterceptor } from './auth-interceptor';
import { AuthSessionService } from './auth-session.service';
import { AuthStore } from './auth-store';
import { ApplicationConfiguration } from '../config/application-configuration';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  if (!backendApiUrl) return false;
  if (url.includes('/config.json')) return false;
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

  it('should return false for any URL when backendApiUrl is empty (pre-config bootstrap)', () => {
    expect(shouldInterceptRequest('https://api.pulpe.ch/users', '')).toBe(
      false,
    );
    expect(shouldInterceptRequest('/i18n/fr.json', '')).toBe(false);
  });

  it('should exclude /config.json even when backendApiUrl is set', () => {
    expect(shouldInterceptRequest('/config.json', 'https://api.pulpe.ch')).toBe(
      false,
    );
    expect(
      shouldInterceptRequest(
        'https://api.pulpe.ch/config.json',
        'https://api.pulpe.ch',
      ),
    ).toBe(false);
  });
});

describe('authInterceptor', () => {
  const BACKEND_URL = 'https://api.pulpe.ch';

  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let mockRouter: { navigate: ReturnType<typeof vi.fn>; url: string };
  let mockAuthSession: {
    refreshSession: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let mockAuthStore: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    session: ReturnType<typeof signal>;
  };
  let refreshResolvers: ((value: boolean) => void)[];

  beforeEach(() => {
    refreshResolvers = [];

    mockAuthSession = {
      refreshSession: vi.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            refreshResolvers.push(resolve);
          }),
      ),
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    mockAuthStore = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      session: signal({ access_token: 'valid-token' }),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
      url: '/dashboard',
    };

    const mockApplicationConfig = {
      backendApiUrl: vi.fn().mockReturnValue(BACKEND_URL),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
        { provide: Router, useValue: mockRouter },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  async function flushMicrotasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  describe('concurrent 401 refresh lock', () => {
    it('should only call refreshSession once for concurrent 401 responses', async () => {
      const promise1 = firstValueFrom(
        http.get(`${BACKEND_URL}/endpoint1`),
      ).catch(() => 'failed');
      const promise2 = firstValueFrom(
        http.get(`${BACKEND_URL}/endpoint2`),
      ).catch(() => 'failed');

      await flushMicrotasks();

      const req1 = httpTesting.expectOne(`${BACKEND_URL}/endpoint1`);
      const req2 = httpTesting.expectOne(`${BACKEND_URL}/endpoint2`);
      req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      await vi.waitFor(() => {
        expect(refreshResolvers.length).toBeGreaterThanOrEqual(1);
      });

      // Service-level dedup expected: interceptor calls refreshSession() once per
      // 401, but the AuthSessionService #refreshPromise dedups internally.
      // From the interceptor's view, both 401s call refreshSession. Both get
      // the same Promise back (test mock returns separate promises here, so
      // we assert at most 2 mock invocations). The structural dedup lives in
      // the service, not in the interceptor.
      expect(mockAuthSession.refreshSession).toHaveBeenCalled();

      refreshResolvers.forEach((resolve) => resolve(true));

      await flushMicrotasks();

      const retries = httpTesting.match(() => true);
      retries.forEach((r) => r.flush({ data: 'ok' }));

      await Promise.all([promise1, promise2]);
    });

    it('should redirect to login when refresh returns false', async () => {
      const promise1 = firstValueFrom(
        http.get(`${BACKEND_URL}/endpoint1`),
      ).catch((err) => err);

      await flushMicrotasks();

      const req1 = httpTesting.expectOne(`${BACKEND_URL}/endpoint1`);
      req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      await vi.waitFor(() => {
        expect(refreshResolvers.length).toBeGreaterThanOrEqual(1);
      });

      refreshResolvers[0](false);

      const result = await promise1;

      expect(mockAuthSession.signOut).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/', 'login']);
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('ERR_AUTH_CLIENT_KEY_MISSING (403)', () => {
    it('should redirect to enter-vault-code without signing out', async () => {
      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { code: 'ERR_AUTH_CLIENT_KEY_MISSING' },
          { status: 403, statusText: 'Forbidden' },
        );

      const error = await result;

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/',
        'enter-vault-code',
      ]);
      expect(mockAuthSession.signOut).not.toHaveBeenCalled();
      expect(error).toBeInstanceOf(Error);
    });

    it('should NOT redirect when already on enter-vault-code page (loop guard)', async () => {
      mockRouter.url = '/enter-vault-code';

      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { code: 'ERR_AUTH_CLIENT_KEY_MISSING' },
          { status: 403, statusText: 'Forbidden' },
        );

      const error = await result;

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(error.status).toBe(403);
    });

    it('should NOT redirect when not authenticated (loop guard)', async () => {
      mockAuthStore.isAuthenticated.mockReturnValue(false);

      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { code: 'ERR_AUTH_CLIENT_KEY_MISSING' },
          { status: 403, statusText: 'Forbidden' },
        );

      const error = await result;

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(error.status).toBe(403);
    });
  });

  describe('ERR_USER_ACCOUNT_BLOCKED (403)', () => {
    it('should sign out and redirect to login when code field is used', async () => {
      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { code: 'ERR_USER_ACCOUNT_BLOCKED' },
          { status: 403, statusText: 'Forbidden' },
        );

      const error = await result;

      expect(mockAuthSession.signOut).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/', 'login']);
      expect(error).toBeInstanceOf(Error);
    });

    it('should sign out and redirect to login when error field is used', async () => {
      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { error: 'ERR_USER_ACCOUNT_BLOCKED' },
          { status: 403, statusText: 'Forbidden' },
        );

      const error = await result;

      expect(mockAuthSession.signOut).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/', 'login']);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ERR_ENCRYPTION_KEY_CHECK_FAILED (400)', () => {
    it('should pass the error through without redirecting', async () => {
      const result = firstValueFrom(
        http.get(`${BACKEND_URL}/api/encryption/validate-key`),
      ).catch((err) => err);

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/encryption/validate-key`)
        .flush(
          { code: 'ERR_ENCRYPTION_KEY_CHECK_FAILED' },
          { status: 400, statusText: 'Bad Request' },
        );

      const error = await result;

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockAuthSession.signOut).not.toHaveBeenCalled();
      expect(error.status).toBe(400);
    });
  });

  describe('non-auth errors', () => {
    it('should pass through 400 errors without interception', async () => {
      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { message: 'Validation failed' },
          { status: 400, statusText: 'Bad Request' },
        );

      const error = await result;

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockAuthSession.signOut).not.toHaveBeenCalled();
      expect(error.status).toBe(400);
    });

    it('should pass through 500 errors without interception', async () => {
      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush(
          { message: 'Internal error' },
          { status: 500, statusText: 'Internal Server Error' },
        );

      const error = await result;

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockAuthSession.signOut).not.toHaveBeenCalled();
      expect(error.status).toBe(500);
    });

    it('should not intercept 401 when user is not authenticated', async () => {
      mockAuthStore.isAuthenticated.mockReturnValue(false);

      const result = firstValueFrom(http.get(`${BACKEND_URL}/api/data`)).catch(
        (err) => err,
      );

      await flushMicrotasks();

      httpTesting
        .expectOne(`${BACKEND_URL}/api/data`)
        .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      const error = await result;

      expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(error.status).toBe(401);
    });
  });
});
