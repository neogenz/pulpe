import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * RealizedBalanceProgressBar - "Journey Tracker" design
 *
 * Segmented progress visualization that makes each checked item tangible.
 * Follows M3 Expressive patterns with personality-driven micro-copy.
 */
@Component({
  selector: 'pulpe-realized-balance-progress-bar',
  imports: [DecimalPipe],
  template: `
    <div class="bg-surface-container-low rounded-2xl p-5">
      <!-- Header with inline info -->
      <div class="flex justify-between items-end mb-5">
        <div>
          <span class="text-label-medium text-on-surface-variant">
            Dépenses réalisées
          </span>
          <div
            class="text-headline-small md:text-headline-medium font-semibold ph-no-capture"
          >
            {{ realizedExpenses() | number: '1.0-0' : 'de-CH' }} CHF
          </div>
        </div>
        <div class="text-right">
          <span
            class="text-label-medium text-on-surface-variant flex items-center justify-end gap-1"
          >
            Solde actuel
            <ng-content select="[slot=title-info]" />
          </span>
          <div
            class="text-headline-small md:text-headline-medium font-semibold ph-no-capture"
            [class.text-primary]="realizedBalance() >= 0"
            [class.text-error]="realizedBalance() < 0"
          >
            {{ realizedBalance() | number: '1.0-0' : 'de-CH' }} CHF
          </div>
        </div>
      </div>

      <!-- Segmented Progress: Visual representation of checked items -->
      <div class="flex gap-1 h-2.5 mb-3">
        @for (segment of progressSegments(); track $index) {
          <div
            class="flex-1 rounded-full transition-all duration-300 ease-out"
            [class.bg-primary]="segment.filled"
            [class.bg-outline-variant/50]="!segment.filled"
            [class.scale-y-110]="segment.filled"
          ></div>
        }
      </div>

      <!-- Label with friendly tone -->
      <p class="text-label-medium text-on-surface-variant text-center">
        {{ checkedCount() }}/{{ totalCount() }} éléments pointés
        @if (totalCount() > 0) {
          <span class="text-on-surface-variant/70">
            —
            @if (progressPercentage() === 100) {
              tout est fait 🎉
            } @else if (progressPercentage() >= 75) {
              presque fini
            } @else if (progressPercentage() >= 50) {
              plus de la moitié
            } @else if (progressPercentage() > 0) {
              on avance
            } @else {
              c'est parti
            }
          </span>
        }
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* Subtle animation for filled segments */
    .scale-y-110 {
      transform: scaleY(1.1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RealizedBalanceProgressBar {
  readonly realizedExpenses = input.required<number>();
  readonly realizedBalance = input.required<number>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();

  readonly progressPercentage = computed(() =>
    this.totalCount() > 0 ? (this.checkedCount() / this.totalCount()) * 100 : 0,
  );

  /**
   * Creates an array of segments for the progress visualization.
   * Limits to 12 segments max for visual clarity, distributing checked items proportionally.
   */
  readonly progressSegments = computed(() => {
    const total = this.totalCount();
    const checked = this.checkedCount();

    if (total === 0) {
      return [];
    }

    // Use actual count if small, otherwise cap at 12 for visual clarity
    const segmentCount = Math.min(total, 12);
    const filledRatio = checked / total;

    return Array.from({ length: segmentCount }, (_, index) => ({
      filled: index < Math.round(filledRatio * segmentCount),
    }));
  });
}
