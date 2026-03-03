import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { BudgetConsumptionState } from '../data-core/budget-item-constants';

const DEFAULT_SEGMENT_COUNT = 10;

/**
 * Segmented progress bar component for budget consumption visualization.
 *
 * Visual structure:
 * ████████████░░░░░░░░  80%
 */
@Component({
  selector: 'pulpe-segmented-budget-progress',
  template: `
    <div class="flex gap-0.5" [style.height.px]="height()">
      @for (i of segments(); track i) {
        <div
          class="flex-1 rounded-full transition-colors"
          [class.bg-secondary]="
            i <= filledSegmentCount() && consumptionState() === 'healthy'
          "
          [class.bg-financial-warning]="
            i <= filledSegmentCount() && consumptionState() === 'near-limit'
          "
          [class.bg-financial-over-budget]="
            consumptionState() === 'over-budget'
          "
          [class.bg-outline-variant/40]="
            consumptionState() !== 'over-budget' && i > filledSegmentCount()
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
export class SegmentedBudgetProgress {
  readonly percentage = input.required<number>();
  /** Expects an active state (not 'no-transactions') — callers must guard with hasTransactions */
  readonly consumptionState = input.required<BudgetConsumptionState>();
  readonly segmentCount = input(DEFAULT_SEGMENT_COUNT);
  readonly height = input(6);

  protected readonly segments = computed(() =>
    Array.from({ length: this.segmentCount() }, (_, i) => i + 1),
  );

  protected readonly segmentValue = computed(() => 100 / this.segmentCount());

  protected readonly filledSegmentCount = computed(
    () => this.percentage() / this.segmentValue(),
  );
}
