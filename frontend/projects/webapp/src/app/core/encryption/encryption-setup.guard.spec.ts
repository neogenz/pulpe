import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptionSetupGuard } from './encryption-setup.guard';
import { ClientKeyService } from './client-key.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { ROUTES } from '@core/routing/routes-constants';

const dummyRoute = {} as ActivatedRouteSnapshot;
const dummyState = {} as RouterStateSnapshot;

describe('encryptionSetupGuard', () => {
  let mockClientKeyService: { hasClientKey: ReturnType<typeof vi.fn> };
  let mockAuthState: {
    authState: ReturnType<typeof vi.fn>;
  };
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

  it('should allow navigation when clientKey exists', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(true);
    mockAuthState.authState.mockReturnValue(createAuthState(null));

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
  });

  it('should allow navigation for email users', () => {
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

    expect(result).toBe(true);
  });

  it('should redirect to ENTER_VAULT_CODE for returning Google user', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        app_metadata: { provider: 'google' },
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

  it('should redirect to SETUP_VAULT_CODE for new Google user', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(
      createAuthState({
        app_metadata: { provider: 'google' },
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

  it('should allow navigation when user is null', () => {
    mockClientKeyService.hasClientKey.mockReturnValue(false);
    mockAuthState.authState.mockReturnValue(createAuthState(null));

    const result = TestBed.runInInjectionContext(() =>
      encryptionSetupGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
  });
});
