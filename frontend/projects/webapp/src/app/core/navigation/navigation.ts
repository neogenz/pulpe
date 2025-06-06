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
  } as const;
  readonly #navigationConfig: NavigationConfig = [
    {
      title: 'Budget',
      items: [
        {
          label: 'Mois en cours',
          route: '/app/current-month',
          icon: 'today',
        },
        {
          label: 'Autres mois',
          route: '/app/other-months',
          icon: 'calendar_month',
        },
        {
          label: 'Modèles de budget',
          route: '/app/budget-templates',
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
