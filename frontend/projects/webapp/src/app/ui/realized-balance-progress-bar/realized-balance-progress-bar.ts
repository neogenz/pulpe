import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * RealizedBalanceProgressBar - Displays progress of checked items
 *
 * Shows:
 * - Left: Total checked expenses (CHF)
 * - Right: Realized balance (CHF)
 * - Progress bar: Ratio of checked items
 * - Label: "X/Y éléments exécutés"
 */
@Component({
  selector: 'pulpe-realized-balance-progress-bar',
  imports: [MatCardModule, MatProgressBarModule, DecimalPipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-4">
        <div class="flex justify-between items-baseline w-full">
          <!-- Left: Realized expenses -->
          <div class="flex flex-col gap-1">
            <span class="text-body-small md:text-body text-on-surface-variant">
              Dépenses réalisées CHF
            </span>
            <span
              class="text-headline-small md:text-headline-large ph-no-capture"
            >
              {{ realizedExpenses() | number: '1.2-2' : 'de-CH' }}
            </span>
          </div>
          <!-- Right: Realized balance -->
          <div class="flex flex-col text-right">
            <span
              class="text-body-small md:text-body text-on-surface-variant flex items-center"
            >
              Solde actuel CHF
              <ng-content select="[slot=title-info]" />
            </span>
            <span
              class="text-headline-small md:text-headline-large ph-no-capture"
              [class.text-financial-income]="realizedBalance() >= 0"
              [class.text-financial-negative]="realizedBalance() < 0"
            >
              {{ realizedBalance() | number: '1.2-2' : 'de-CH' }}
            </span>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content class="space-y-2">
        <mat-progress-bar mode="determinate" [value]="progressPercentage()" />
        <div class="text-label-small text-on-surface-variant ph-no-capture">
          {{ checkedCount() }}/{{ totalCount() }} éléments exécutés
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;
      @include mat.progress-bar-overrides(
        (
          track-height: 10px,
          active-indicator-height: 10px,
        )
      );
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
}
