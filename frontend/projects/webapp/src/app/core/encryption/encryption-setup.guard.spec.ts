import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { encryptionSetupGuard } from './encryption-setup.guard';
import { ClientKeyService } from './client-key.service';
import { EncryptionApi } from './encryption-api';
import { AuthStateService } from '@core/auth/auth-state.service';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { ROUTES } from '@core/routing/routes-constants';

const dummyRoute = {} as ActivatedRouteSnapshot;
const dummyState = {} as RouterStateSnapshot;

describe('encryptionSetupGuard', () => {
  let mockClientKeyService: {
    hasClientKey: ReturnType<typeof vi.fn>;
    clientKeyHex: ReturnType<typeof vi.fn>;
    needsServerValidation: ReturnType<typeof vi.fn>;
    markValidated: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let mockAuthState: {
    authState: ReturnType<typeof vi.fn>;
  };
  let mockDemoModeService: {
    isDemoMode: ReturnType<typeof vi.fn>;
  };
  let mockEncryptionApi: {
    validateKey$: ReturnType<typeof vi.fn>;
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

  function createUrlTreeStub(path: string): UrlTree {
    return { toString: () => path } as unknown as UrlTree;
  }

  beforeEach(() => {
    mockClientKeyService = {
      hasClientKey: vi.fn().mockReturnValue(false),
      clientKeyHex: vi.fn().mockReturnValue(null),
      needsServerValidation: vi.fn().mockReturnValue(false),
      markValidated: vi.fn(),
      clear: vi.fn(),
    };

    mockAuthState = {
      authState: vi.fn(),
    };

    mockDemoModeService = {
      isDemoMode: vi.fn().mockReturnValue(false),
    };

    mockEncryptionApi = {
      validateKey$: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi
        .fn()
        .mockImplementation((segments: string[]) =>
          createUrlTreeStub(segments.join('/')),
        ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runGuard(): ReturnType<typeof encryptionSetupGuard> {
    return TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );
  }

  async function resolveGuard(): Promise<boolean | UrlTree> {
    const result = runGuard();
    if (result instanceof Observable) {
      return firstValueFrom(result as Observable<boolean | UrlTree>);
    }
    return result as boolean | UrlTree;
  }

  describe('demo mode', () => {
    it('should allow navigation without any checks', async () => {
      mockDemoModeService.isDemoMode.mockReturnValue(true);
      mockClientKeyService.hasClientKey.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: {} }),
      );

      const result = runGuard();

      expect(result).toBe(true);
      expect(mockEncryptionApi.validateKey$).not.toHaveBeenCalled();
    });
  });

  describe('sync auth state (not loading)', () => {
    it('should allow when clientKey exists, vaultCodeConfigured, and no validation needed', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockClientKeyService.needsServerValidation.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      const result = await resolveGuard();

      expect(result).toBe(true);
      expect(mockEncryptionApi.validateKey$).not.toHaveBeenCalled();
    });

    it('should redirect to ENTER_VAULT_CODE for user with vaultCodeConfigured but no key', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      await resolveGuard();

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should redirect to SETUP_VAULT_CODE for user without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: {} }),
      );

      await resolveGuard();

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should redirect to SETUP_VAULT_CODE when user is null', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(createAuthState(null));

      await resolveGuard();

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should clear stale key for non-email user without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: {} }),
      );

      await resolveGuard();

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should keep migration key for email user without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockAuthState.authState.mockReturnValue(
        createAuthState({
          app_metadata: { provider: 'email' },
          user_metadata: {},
        }),
      );

      await resolveGuard();

      expect(mockClientKeyService.clear).not.toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should redirect email user with vaultCodeConfigured but no key to ENTER_VAULT_CODE', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);
      mockAuthState.authState.mockReturnValue(
        createAuthState({
          app_metadata: { provider: 'email' },
          user_metadata: { vaultCodeConfigured: true },
        }),
      );

      await resolveGuard();

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });
  });

  describe('server validation of stale localStorage keys', () => {
    beforeEach(() => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockClientKeyService.needsServerValidation.mockReturnValue(true);
      mockClientKeyService.clientKeyHex.mockReturnValue('abcdef1234567890');
      mockAuthState.authState.mockReturnValue(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );
    });

    it('should validate key against server when needsServerValidation is true', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

      await resolveGuard();

      expect(mockEncryptionApi.validateKey$).toHaveBeenCalledWith(
        'abcdef1234567890',
      );
    });

    it('should mark validated and allow access on successful server validation', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

      const result = await resolveGuard();

      expect(result).toBe(true);
      expect(mockClientKeyService.markValidated).toHaveBeenCalled();
      expect(mockClientKeyService.clear).not.toHaveBeenCalled();
    });

    it('should clear key and redirect to ENTER_VAULT_CODE on failed server validation', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(() => ({ status: 400 })),
      );

      await resolveGuard();

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockClientKeyService.markValidated).not.toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should clear key and redirect on network error during validation', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await resolveGuard();

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should redirect to ENTER_VAULT_CODE when clientKeyHex is unexpectedly null', async () => {
      mockClientKeyService.clientKeyHex.mockReturnValue(null);

      await resolveGuard();

      expect(mockEncryptionApi.validateKey$).not.toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should skip validation when needsServerValidation is false (sessionStorage key)', async () => {
      mockClientKeyService.needsServerValidation.mockReturnValue(false);

      const result = await resolveGuard();

      expect(result).toBe(true);
      expect(mockEncryptionApi.validateKey$).not.toHaveBeenCalled();
    });
  });

  describe('async auth state (isLoading=true)', () => {
    beforeEach(() => {
      authStateSignal = signal(createAuthState(null, true));
      Object.assign(mockAuthState, { authState: authStateSignal });
    });

    it('should wait and allow when auth resolves with key + vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockClientKeyService.needsServerValidation.mockReturnValue(false);

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      expect(await promise).toBe(true);
    });

    it('should wait and redirect to ENTER_VAULT_CODE when no key', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(false);

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      await promise;

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });

    it('should clear stale key when async state resolves without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(createAuthState({ user_metadata: {} }));

      await promise;

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should keep migration key in async flow for email user without vaultCodeConfigured', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(
        createAuthState({
          app_metadata: { provider: 'email' },
          user_metadata: {},
        }),
      );

      await promise;

      expect(mockClientKeyService.clear).not.toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.SETUP_VAULT_CODE,
      ]);
    });

    it('should validate stale key after async auth resolves', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockClientKeyService.needsServerValidation.mockReturnValue(true);
      mockClientKeyService.clientKeyHex.mockReturnValue('stale-key-hex');
      mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      expect(await promise).toBe(true);
      expect(mockEncryptionApi.validateKey$).toHaveBeenCalledWith(
        'stale-key-hex',
      );
      expect(mockClientKeyService.markValidated).toHaveBeenCalled();
    });

    it('should clear key and redirect when async validation fails', async () => {
      mockClientKeyService.hasClientKey.mockReturnValue(true);
      mockClientKeyService.needsServerValidation.mockReturnValue(true);
      mockClientKeyService.clientKeyHex.mockReturnValue('wrong-key');
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(() => ({ status: 400 })),
      );

      const result$ = runGuard() as Observable<boolean | UrlTree>;
      const promise = firstValueFrom(result$);

      authStateSignal.set(
        createAuthState({ user_metadata: { vaultCodeConfigured: true } }),
      );

      await promise;

      expect(mockClientKeyService.clear).toHaveBeenCalled();
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.ENTER_VAULT_CODE,
      ]);
    });
  });
});
