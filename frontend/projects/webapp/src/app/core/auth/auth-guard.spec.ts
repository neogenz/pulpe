import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@core/routing/routes-constants';
import { authGuard } from './auth-guard';
import { type AuthState, AuthStateService } from './auth-state.service';

describe('authGuard', () => {
  let stateSignal: ReturnType<typeof signal<AuthState>>;
  let mockRouter: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    stateSignal = signal<AuthState>({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
    });

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    const mockAuthState = {
      authState: stateSignal.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow navigation synchronously when authenticated and resolved', async () => {
    stateSignal.set({
      user: {} as AuthState['user'],
      session: {} as AuthState['session'],
      isLoading: false,
      isAuthenticated: true,
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to login synchronously when unauthenticated and resolved', async () => {
    stateSignal.set({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([ROUTES.LOGIN]);
  });

  it('should allow navigation asynchronously once auth state resolves to authenticated', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState),
    );

    expect(typeof result).not.toBe('boolean');
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();

    stateSignal.set({
      user: {} as AuthState['user'],
      session: {} as AuthState['session'],
      isLoading: false,
      isAuthenticated: true,
    });

    await expect(
      firstValueFrom(result as Observable<boolean | UrlTree>),
    ).resolves.toBe(true);
  });

  it('should redirect to login asynchronously once auth state resolves to unauthenticated', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState),
    );

    stateSignal.set({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    await firstValueFrom(result as Observable<boolean | UrlTree>);

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([ROUTES.LOGIN]);
  });
});
