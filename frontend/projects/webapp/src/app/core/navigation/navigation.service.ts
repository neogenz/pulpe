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
export class NavigationService {
  private readonly router = inject(Router);

  private readonly navigationConfig: NavigationConfig = [
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
    this.navigationConfig,
  );

  getNavigationConfig(): readonly NavigationSection[] {
    return this.navigationConfig;
  }

  navigateToItem(navigationItem: NavigationItem): Promise<boolean> {
    return this.router.navigate([navigationItem.route]);
  }

  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }
}
