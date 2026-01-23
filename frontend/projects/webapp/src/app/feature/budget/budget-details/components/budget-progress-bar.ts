import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

const DEFAULT_SEGMENT_COUNT = 10;

/**
 * Segmented progress bar component for budget consumption visualization.
 *
 * Visual structure:
 * ████████████░░░░░░░░  80%
 */
@Component({
  selector: 'pulpe-budget-progress-bar',
  template: `
    <div class="flex gap-0.5" [style.height.px]="height()">
      @for (i of segments(); track i) {
        <div
          class="flex-1 rounded-full transition-colors"
          [class.bg-primary]="
            i <= percentage() / segmentValue() && percentage() <= 100
          "
          [class.bg-error]="percentage() > 100"
          [class.bg-outline-variant/40]="
            i > percentage() / segmentValue() ||
            (percentage() > 100 && i > segmentCount())
          "
        ></div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressBar {
  readonly percentage = input.required<number>();
  readonly segmentCount = input(DEFAULT_SEGMENT_COUNT);
  readonly height = input(6);

  protected readonly segments = computed(() =>
    Array.from({ length: this.segmentCount() }, (_, i) => i + 1),
  );

  protected readonly segmentValue = computed(() => 100 / this.segmentCount());
}
