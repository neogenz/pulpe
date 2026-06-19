import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-17 — "Lissé" pill marking a budget line that belongs to a spread group.
 * Real button: clicking opens the cross-month occurrences panel for the group.
 * Icon `date_range` (NEVER `repeat` — that's reserved for the Récurrent chip).
 * Distinct tertiary-container color so it doesn't read as a recurrence chip.
 */
@Component({
  selector: 'pulpe-spread-pill',
  imports: [MatIconModule, TranslocoPipe],
  template: `
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5
             bg-tertiary-container text-on-tertiary-container text-label-small
             font-medium w-fit cursor-pointer transition-colors
             hover:bg-tertiary-container/80 focus-visible:outline-2
             focus-visible:outline-offset-2 focus-visible:outline-tertiary"
      [attr.aria-label]="'budgetLine.spread.pillAriaLabel' | transloco"
      [attr.data-testid]="'spread-pill-' + spreadGroupId()"
      (click)="open($event)"
    >
      <mat-icon class="text-sm! h-auto! w-auto! shrink-0">date_range</mat-icon>
      {{ 'budgetLine.spread.pill' | transloco }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadPill {
  readonly spreadGroupId = input.required<string>();
  readonly openOccurrences = output<string>();

  protected open(event: Event): void {
    event.stopPropagation();
    this.openOccurrences.emit(this.spreadGroupId());
  }
}
