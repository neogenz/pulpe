import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firstValueFrom, type Observable } from 'rxjs';
import { encryptionSetupGuard } from './encryption-setup.guard';
import { ClientKeyService } from './client-key.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { ROUTES } from '@core/routing/routes-constants';

const dummyRoute = {} as ActivatedRouteSnapshot;
const dummyState = {} as RouterStateSnapshot;

describe('encryptionSetupGuard', () => {
  let mockClientKeyService: {
    hasClientKey: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let mockAuthState: {
    authState: ReturnType<typeof vi.fn>;
  };
  let authStateSignal: ReturnType<typeof signal>;
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };

  function createAuthState(
    user: Record<string, unknown> | null,
    isLoading = false,
  ) {
    return {
      user,
      session: user ? {} : null,
      isLoading,
      isAuthenticated: !!user && !isLoading,
    };
  }

  beforeEach(() => {
    mockClientKeyService = {
      hasClientKey: vi.fn(),
      clear: vi.fn(),
    };

    mockAuthState = {
      authState: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow navigation when clientKey exists and user has vaultCodeConfigured', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(true);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        user_metadata: { vaultCodeConfigured: true },
      }),
    );

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
  });

  it('should clear stale key and redirect to SETUP_VAULT_CODE when clientKey exists but user has no vaultCodeConfigured', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(true);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        user_metadata: {},
      }),
    );

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(mockClientKeyService.clear).toHaveBeenCalled();
    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.SETUP_VAULT_CODE,
    ]);
  });

  it('should redirect to ENTER_VAULT_CODE for user with vaultCodeConfigured', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        user_metadata: { vaultCodeConfigured: true },
      }),
    );

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.ENTER_VAULT_CODE,
    ]);
  });

  it('should redirect to SETUP_VAULT_CODE for user without vaultCodeConfigured', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        user_metadata: {},
      }),
    );

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.SETUP_VAULT_CODE,
    ]);
  });

  it('should redirect to SETUP_VAULT_CODE for email user without vault code', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        app_metadata: { provider: 'email' },
        user_metadata: {},
      }),
    );

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.SETUP_VAULT_CODE,
    ]);
  });

  it('should redirect to SETUP_VAULT_CODE when user is null', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(createAuthState(null));

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.SETUP_VAULT_CODE,
    ]);
  });

  describe('Async auth state (isLoading=true)', () => {
    beforeEach(() => {
      authStateSignal = signal(createAuthState(null, true));
      mockAuthState.authState = authStateSignal as unknown as ReturnType<
        typeof vi.fn
      >;
    });

    it('should wait and allow when auth resolves with key + vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        encryptionSetupGuard(dummyRoute, dummyState),
      ) as Observable<boolean | UrlTree>;

      const promise = firstValueFrom(result);

      authStateSignal.set(
        createAuthState({
          user_metadata: { vaultCodeConfigured: true },
        }),
      );

      expect(await promise).toBe(true);
    });

    it('should wait and redirect to ENTER_VAULT_CODE when no key', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        encryptionSetupGuard(dummyRoute, dummyState),
      ) as Observable<boolean | UrlTree>;

      const promise = firstValueFrom(result);

      authStateSignal.set(
        createAuthState({
          user_metadata: { vaultCodeConfigured: true },
        }),
      );

      await promise;

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should clear stale key when async state resolves without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        encryptionSetupGuard(dummyRoute, dummyState),
      ) as Observable<boolean | UrlTree>;

      const promise = firstValueFrom(result);

      authStateSignal.set(
        createAuthState({
          user_metadata: {},
        }),
      );

      await promise;

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });
  });
});
