import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  input,
  contentChildren,
  contentChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BreadcrumbItemDirective } from './breadcrumb-item.directive';
import { BreadcrumbSeparatorDirective } from './breadcrumb-separator.directive';

@Component({
  selector: 'pulpe-breadcrumb-new',
  standalone: true,
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ol class="flex items-center list-none p-0 m-0 flex-wrap text-sm">
        @for (
          item of items();
          track item;
          let last = $last;
          let first = $first
        ) {
          <li>
            <ng-template [ngTemplateOutlet]="item.templateRef"></ng-template>
          </li>
          @if (!last) {
            <li aria-hidden="true">
              @if (separatorTemplateRef()) {
                <ng-template
                  [ngTemplateOutlet]="separatorTemplateRef()!.templateRef"
                ></ng-template>
              } @else {
                <mat-icon class="!text-base text-outline align-middle"
                  >chevron_right</mat-icon
                >
              }
            </li>
          }
        }
      </ol>
    </nav>
  `,
  imports: [MatIconModule, NgTemplateOutlet],
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PulpeBreadcrumbNew {
  ariaLabel = input<string>('Breadcrumb', { alias: 'aria-label' });

  items = contentChildren<BreadcrumbItemDirective>(BreadcrumbItemDirective);
  separatorTemplateRef = contentChild<BreadcrumbSeparatorDirective>(
    BreadcrumbSeparatorDirective,
  );
}
