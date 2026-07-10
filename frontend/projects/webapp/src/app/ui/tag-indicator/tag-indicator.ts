import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-18 — compact tag indicator for transaction / budget-line rows and tiles.
 *
 * Instead of always-visible pills (noisy once a row carries several tags), it
 * shows a single `sell` glyph + count. The full tag-name list appears on hover
 * (desktop) and on tap/long-press (mobile) via `matTooltipTouchGestures="on"`.
 *
 * ui/ layer: takes already-resolved `tagNames` (the feature layer resolves
 * ids -> names via TagStore), so this component never imports @core/.
 */
@Component({
  selector: 'pulpe-tag-indicator',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (tagNames().length > 0) {
      <span
        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 shrink-0
               bg-secondary-container text-on-secondary-container text-label-small font-medium
               ph-no-capture"
        [matTooltip]="tooltip()"
        matTooltipClass="whitespace-pre-line"
        matTooltipTouchGestures="on"
        matTooltipPosition="above"
        [attr.aria-label]="
          'tagIndicator.ariaLabel'
            | transloco: { count: tagNames().length, names: tooltip() }
        "
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
