import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface BreadcrumbItemViewModel {
  readonly label: string;
  readonly url: string;
  readonly icon?: string;
  readonly isActive?: boolean;
}

@Component({
  selector: 'pulpe-breadcrumb',
  imports: [RouterLink, MatIconModule],
  template: `
    @if (items().length >= 2) {
      <nav aria-label="Breadcrumb" class="flex items-center gap-2 text-sm">
        @for (item of items(); track item.url; let isLast = $last) {
          @if (!isLast) {
            <a
              [routerLink]="item.url"
              class="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors"
            >
              @if (item.icon) {
                <mat-icon class="!text-base">{{ item.icon }}</mat-icon>
              }
              {{ item.label }}
            </a>
            <mat-icon class="!text-base text-outline">chevron_right</mat-icon>
          } @else {
            <span class="flex items-center gap-1 text-on-surface font-medium">
              @if (item.icon) {
                <mat-icon class="!text-base">{{ item.icon }}</mat-icon>
              }
              {{ item.label }}
            </span>
          }
        }
      </nav>
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
