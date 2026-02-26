import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

const MAX_SEGMENTS = 12;

@Component({
  selector: 'pulpe-budget-verification-block',
  imports: [DecimalPipe],
  template: `
    <div class="bg-surface-container-low rounded-2xl p-5">
      <!-- Section title -->
      <div class="flex items-center gap-2 mb-4">
        <p class="text-title-medium text-on-surface">Vérifie ton solde</p>
        <ng-content select="[slot=title-info]" />
      </div>

      <!-- Progress label -->
      <p class="text-label-medium text-on-surface-variant text-center">
        {{ checkedCount() }} / {{ totalCount() }} éléments pointés
        @if (totalCount() > 0) {
          <span class="text-on-surface-variant/70">
            —
            @if (isComplete()) {
              tout est pointé ! Ton solde estimé devrait correspondre à celui de
              ta banque 🎉
            } @else if (progressPercentage() >= 75) {
              presque fini — pense à vérifier tes dépenses variables
            } @else if (progressPercentage() >= 50) {
              plus de la moitié
            } @else if (progressPercentage() > 0) {
              on avance — continue avec tes charges fixes
            } @else {
              c'est parti — pointe tes premiers éléments
            }
          </span>
        }
      </p>

      <!-- Segmented progress bar -->
      <div
        role="progressbar"
        [attr.aria-valuenow]="progressPercentage()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="
          checkedCount() + ' sur ' + totalCount() + ' éléments pointés'
        "
        class="flex gap-1 h-2.5 my-3"
      >
        @for (segment of progressSegments(); track $index) {
          <div
            class="flex-1 rounded-full transition-all duration-300 ease-out"
            [class.bg-primary]="segment.filled"
            [class.bg-outline-variant/50]="!segment.filled"
            [class.scale-y-110]="segment.filled"
          ></div>
        }
      </div>

      <!-- Narrative text -->
      <p class="text-body-large text-on-surface-variant text-center mt-4">
        Sur ton compte, il devrait te rester :
      </p>

      <!-- Estimated balance (hero) -->
      <div
        class="text-headline-medium md:text-display-small font-semibold text-center ph-no-capture mt-2"
        [class.text-primary]="estimatedBalance() >= 0"
        [class.text-financial-negative]="estimatedBalance() < 0"
      >
        {{ estimatedBalance() | number: '1.0-0' : 'de-CH' }} CHF
      </div>

      <!-- Checked expenses (secondary) -->
      <p
        class="text-body-medium text-on-surface-variant text-center mt-2 ph-no-capture"
      >
        dont {{ checkedExpenses() | number: '1.0-0' : 'de-CH' }} CHF de dépenses
        pointées
      </p>

      <!-- Gap indicator (hidden in deficit or when all items checked) -->
      @if (gap() > 0 && !isComplete() && estimatedBalance() >= 0) {
        <p
          class="text-body-small text-on-surface-variant/60 text-center mt-1 ph-no-capture"
        >
          Écart de {{ gap() | number: '1.0-0' : 'de-CH' }} CHF — ce sont tes
          prévisions pas encore pointées
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .scale-y-110 {
      transform: scaleY(1.1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetVerificationBlock {
  readonly checkedExpenses = input.required<number>();
  readonly estimatedBalance = input.required<number>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly plannedRemaining = input.required<number>();

  readonly isComplete = computed(
    () => this.totalCount() > 0 && this.checkedCount() === this.totalCount(),
  );

  readonly progressPercentage = computed(() =>
    this.totalCount() > 0 ? (this.checkedCount() / this.totalCount()) * 100 : 0,
  );

  readonly progressSegments = computed(() => {
    const total = this.totalCount();
    const checked = this.checkedCount();

    if (total === 0) {
      return [];
    }

    const segmentCount = Math.min(total, MAX_SEGMENTS);
    const filledRatio = checked / total;

    return Array.from({ length: segmentCount }, (_, index) => ({
      filled: index < Math.round(filledRatio * segmentCount),
    }));
  });

  readonly gap = computed(() =>
    Math.abs(this.estimatedBalance() - this.plannedRemaining()),
  );
}
