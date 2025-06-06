import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class RootNavigation {
  readonly #router = inject(Router);

  // Root paths constants - only main routes, not sub-routes
  static readonly PATHS = {
    HOME: '',
    LOGIN: 'login',
    ONBOARDING: 'onboarding',
    APP: 'app',
  } as const;

  // Navigation methods for root paths only
  navigateToHome(): Promise<boolean> {
    return this.#router.navigate([RootNavigation.PATHS.HOME]);
  }

  navigateToLogin(): Promise<boolean> {
    return this.#router.navigate([RootNavigation.PATHS.LOGIN]);
  }

  navigateToOnboarding(): Promise<boolean> {
    return this.#router.navigate([RootNavigation.PATHS.ONBOARDING]);
  }

  navigateToApp(): Promise<boolean> {
    return this.#router.navigate([RootNavigation.PATHS.APP]);
  }

  // Utility method for custom navigation
  navigateTo(path: string): Promise<boolean> {
    return this.#router.navigate([path]);
  }

  // Get available root paths
  getRootPaths(): typeof RootNavigation.PATHS {
    return RootNavigation.PATHS;
  }
}