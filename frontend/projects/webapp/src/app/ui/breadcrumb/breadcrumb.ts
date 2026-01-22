import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  contentChildren,
  contentChild,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BreadcrumbItemDirective } from './breadcrumb-item.directive';
import { BreadcrumbSeparatorDirective } from './breadcrumb-separator.directive';

export interface BreadcrumbItemViewModel {
  readonly label: string;
  readonly url: string;
  readonly icon?: string;
}

@Component({
  selector: 'pulpe-breadcrumb',

  imports: [NgTemplateOutlet, RouterLink, MatIconModule, MatButtonModule],
  template: `
    @if (hasContentProjection() || showDataDrivenMode()) {
      <nav [attr.aria-label]="ariaLabel()">
        <ol
          class="flex items-center list-none p-0 m-0 flex-nowrap text-sm overflow-x-auto overflow-y-hidden"
        >
          <!-- Content projection mode -->
          @if (hasContentProjection()) {
            @for (item of projectedItems(); track item; let last = $last) {
              <li>
                <ng-template
                  [ngTemplateOutlet]="item.templateRef"
                ></ng-template>
              </li>
              @if (!last) {
                <li aria-hidden="true">
                  @if (separatorTemplateRef()) {
                    <ng-template
                      [ngTemplateOutlet]="separatorTemplateRef()!.templateRef"
                    ></ng-template>
                  } @else {
                    <mat-icon class="!text-base text-outline align-middle">{{
                      defaultSeparatorIcon
                    }}</mat-icon>
                  }
                </li>
              }
            }
          }

          <!-- Data-driven mode -->
          @else if (showDataDrivenMode()) {
            @for (item of items(); track item.url; let isLast = $last) {
              <li class="flex-shrink-0">
                @if (!isLast) {
                  <a
                    mat-button
                    [routerLink]="item.url"
                    [style.--mat-button-text-label-text-color]="
                      'var(--mat-sys-primary)'
                    "
                    class="px-2 text-on-surface-variant hover:text-primary"
                  >
                    @if (item.icon) {
                      <mat-icon class="!text-base mr-1 flex-shrink-0">{{
                        item.icon
                      }}</mat-icon>
                    }
                    <span>{{ item.label }}</span>
                  </a>
                } @else {
                  <span
                    class="flex items-center gap-1 text-on-surface font-medium px-2"
                    aria-current="page"
                  >
                    @if (item.icon) {
                      <mat-icon class="!text-base flex-shrink-0">{{
                        item.icon
                      }}</mat-icon>
                    }
                    <span>{{ item.label }}</span>
                  </span>
                }
              </li>
              @if (!isLast) {
                <li aria-hidden="true" class="flex-shrink-0">
                  <mat-icon class="!text-base text-outline align-middle">{{
                    defaultSeparatorIcon
                  }}</mat-icon>
                </li>
              }
            }
          }
        </ol>
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
  // Data-driven mode
  readonly items = input<BreadcrumbItemViewModel[]>([]);

  // Content projection mode
  readonly ariaLabel = input<string>('Breadcrumb', { alias: 'aria-label' });
  readonly projectedItems = contentChildren<BreadcrumbItemDirective>(
    BreadcrumbItemDirective,
  );
  readonly separatorTemplateRef = contentChild<BreadcrumbSeparatorDirective>(
    BreadcrumbSeparatorDirective,
  );

  readonly hasContentProjection = computed(
    () => this.projectedItems().length > 0,
  );

  readonly showDataDrivenMode = computed(
    () => !this.hasContentProjection() && this.items().length >= 2,
  );

  readonly defaultSeparatorIcon = 'chevron_right';
}
