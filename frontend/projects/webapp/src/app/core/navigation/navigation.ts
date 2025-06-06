import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  NavigationConfig,
  NavigationItem,
  NavigationSection,
} from './navigation.models';

@Injectable({
  providedIn: 'root',
})
export class Navigation {
  readonly #router = inject(Router);

  // Root paths constants
  static readonly PATHS = {
    HOME: '',
    LOGIN: 'login',
    ONBOARDING: 'onboarding',
    APP: 'app',
    // App sub-routes
    CURRENT_MONTH: 'app/current-month',
    OTHER_MONTHS: 'app/other-months',
    BUDGET_TEMPLATES: 'app/budget-templates',
    // Onboarding sub-routes (commonly used)
    ONBOARDING_REGISTRATION: 'onboarding/registration',
    ONBOARDING_WELCOME: 'onboarding/welcome',
  } as const;
  readonly #navigationConfig: NavigationConfig = [
    {
      title: 'Budget',
      items: [
        {
          label: 'Mois en cours',
          route: `/${Navigation.PATHS.CURRENT_MONTH}`,
          icon: 'today',
        },
        {
          label: 'Autres mois',
          route: `/${Navigation.PATHS.OTHER_MONTHS}`,
          icon: 'calendar_month',
        },
        {
          label: 'Modèles de budget',
          route: `/${Navigation.PATHS.BUDGET_TEMPLATES}`,
          icon: 'description',
        },
      ],
    },
  ];

  readonly navigationSections = signal<readonly NavigationSection[]>(
    this.#navigationConfig,
  );

  getNavigationConfig(): readonly NavigationSection[] {
    return this.#navigationConfig;
  }

  navigateToItem(navigationItem: NavigationItem): Promise<boolean> {
    return this.#router.navigate([navigationItem.route]);
  }

  isRouteActive(route: string): boolean {
    return this.#router.url === route;
  }

  // Navigation methods for root paths
  navigateToHome(): Promise<boolean> {
    return this.#router.navigate([Navigation.PATHS.HOME]);
  }

  navigateToLogin(): Promise<boolean> {
    return this.#router.navigate([Navigation.PATHS.LOGIN]);
  }

  navigateToOnboarding(): Promise<boolean> {
    return this.#router.navigate([Navigation.PATHS.ONBOARDING]);
  }

  navigateToApp(): Promise<boolean> {
    return this.#router.navigate([Navigation.PATHS.APP]);
  }

  // Utility method for custom navigation
  navigateTo(path: string): Promise<boolean> {
    return this.#router.navigate([path]);
  }

  // Get available root paths
  getRootPaths(): typeof Navigation.PATHS {
    return Navigation.PATHS;
  }
}
