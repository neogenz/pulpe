import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-tag-indicator',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (tagNames().length > 0) {
      <span
        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 shrink-0
               bg-secondary-container text-on-secondary-container text-label-small font-medium
               ph-no-capture focus-visible:outline-2 focus-visible:outline-primary
               focus-visible:outline-offset-2"
        [matTooltip]="tooltip()"
        matTooltipClass="whitespace-pre-line"
        matTooltipTouchGestures="on"
        matTooltipPosition="above"
        [attr.aria-label]="
          'tagIndicator.ariaLabel'
            | transloco: { count: tagNames().length, names: tooltip() }
        "
        role="note"
        tabindex="0"
      >
        <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">sell</mat-icon>
        {{ tagNames().length }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagIndicator {
  readonly tagNames = input<readonly string[]>([]);

  protected readonly tooltip = computed(() => this.tagNames().join('\n'));
}
