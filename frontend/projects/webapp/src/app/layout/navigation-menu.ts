import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { ROUTES } from '../core/routing/routes-constants';

interface NavigationItem {
  label: string;
  route: string;
  icon: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const NAVIGATION_CONFIG: NavigationSection[] = [
  {
    title: 'Budget',
    items: [
      {
        label: 'Mois en cours',
        route: ROUTES.CURRENT_MONTH,
        icon: 'today',
      },
      {
        label: 'Mes budgets',
        route: ROUTES.BUDGET,
        icon: 'calendar_month',
      },
      {
        label: 'Modèles de budget',
        route: ROUTES.BUDGET_TEMPLATES,
        icon: 'description',
      },
    ],
  },
];
@Component({
  selector: 'pulpe-navigation-menu',
  imports: [MatIconModule, MatListModule, RouterModule],
  template: `
    <div class="h-full">
      <div class="bg-surface-container rounded-2xl h-full px-2">
        <div class="flex justify-center items-center py-4">
          <div class="w-10 h-10 pulpe-gradient rounded-full"></div>
        </div>

        <mat-nav-list>
          @for (section of navigationSections(); track $index) {
            <div mat-subheader>{{ section.title }}</div>
            @for (item of section.items; track $index) {
              <a
                mat-list-item
                [routerLink]="item.route"
                routerLinkActive="active"
                (click)="onNavItemClick($event)"
              >
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
          }
        </mat-nav-list>
      </div>
    </div>
  `,
  styles: [
    `
      @use '@angular/material' as mat;
      :host {
        display: block;
      }

      .active {
        --mat-list-list-item-label-text-color: var(
          --mat-sys-on-secondary-container
        );
        --mat-list-list-item-leading-icon-color: var(
          --mat-sys-on-secondary-container
        );
        --mat-list-list-item-container-color: var(
          --mat-sys-secondary-container
        );
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationMenu {
  readonly navigationSections = signal<NavigationSection[]>(NAVIGATION_CONFIG);
  readonly navItemClick = output<MouseEvent>();

  onNavItemClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    // Only blur if not navigated via keyboard
    if (event.detail !== 0) {
      target.blur();
    }
    this.navItemClick.emit(event);
  }
}
