import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PulpeBreadcrumbNew } from './breadcrumb-new.component';
import { BreadcrumbItemDirective } from './breadcrumb-item.directive';
import { BreadcrumbSeparatorDirective } from './breadcrumb-separator.directive';

export interface BreadcrumbItemViewModel {
  readonly label: string;
  readonly url: string;
  readonly icon?: string;
  readonly isActive?: boolean;
}

@Component({
  selector: 'pulpe-breadcrumb',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    BreadcrumbSeparatorDirective,
  ],
  template: `
    @if (items().length >= 2) {
      <pulpe-breadcrumb-new>
        @for (item of items(); track item.url; let isLast = $last) {
          @if (!isLast) {
            <a
              mat-button
              *pulpeBreadcrumbItem
              [routerLink]="item.url"
              class="min-w-0 px-2 text-on-surface-variant hover:text-primary"
            >
              @if (item.icon) {
                <mat-icon class="!text-base mr-1">{{ item.icon }}</mat-icon>
              }
              {{ item.label }}
            </a>
          } @else {
            <span
              *pulpeBreadcrumbItem
              class="flex items-center gap-1 text-on-surface font-medium px-2"
            >
              @if (item.icon) {
                <mat-icon class="!text-base">{{ item.icon }}</mat-icon>
              }
              {{ item.label }}
            </span>
          }
        }
      </pulpe-breadcrumb-new>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PulpeBreadcrumb {
  readonly items = input.required<BreadcrumbItemViewModel[]>();
}
