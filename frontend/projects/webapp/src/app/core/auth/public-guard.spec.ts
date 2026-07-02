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
import { publicGuard } from './public-guard';
import { type AuthState, AuthStore } from './auth-store';

describe('publicGuard', () => {
  let stateSignal: ReturnType<typeof signal<AuthState>>;
  let mockRouter: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const mockUrlTree = {} as UrlTree;
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  const runGuard = (): Observable<boolean | UrlTree> =>
    TestBed.runInInjectionContext(
      () => publicGuard(mockRoute, mockState) as Observable<boolean | UrlTree>,
    );

  beforeEach(() => {
    stateSignal = signal<AuthState>({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
    });

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue(mockUrlTree),
    };

    const mockAuthStore = {
      authState: stateSignal.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow navigation when unauthenticated and resolved', async () => {
    stateSignal.set({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to dashboard when authenticated and resolved', async () => {
    stateSignal.set({
      user: {} as AuthState['user'],
      session: {} as AuthState['session'],
      isLoading: false,
      isAuthenticated: true,
    });

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.DASHBOARD,
    ]);
  });

  it('should wait for auth state to resolve before allowing navigation', async () => {
    const resultPromise = firstValueFrom(runGuard());

    stateSignal.set({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    await expect(resultPromise).resolves.toBe(true);
  });

  it('should wait for auth state to resolve before redirecting to dashboard', async () => {
    const resultPromise = firstValueFrom(runGuard());

    stateSignal.set({
      user: {} as AuthState['user'],
      session: {} as AuthState['session'],
      isLoading: false,
      isAuthenticated: true,
    });

    await expect(resultPromise).resolves.toBe(mockUrlTree);
  });
});
