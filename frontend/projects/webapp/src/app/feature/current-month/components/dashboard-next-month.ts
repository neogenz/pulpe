import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

@Component({
  selector: 'pulpe-dashboard-next-month',
  imports: [MatIconModule, MatButtonModule, TranslocoPipe, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0!"
          >
            <mat-icon aria-hidden="true">event_upcoming</mat-icon>
          </div>
          <div class="min-w-0">
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.nextMonthTitle' | transloco }}
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5 capitalize"
            >
              {{ monthName() }} {{ forecast().year }}
            </p>
          </div>
        </div>
        <!-- The no-budget branch below has always offered a way forward; the
             branch that found one left the reader at a dead end — a sentence
             about next month with nothing to do about it, in a row of cards
             that all carry a trailing action. The list is the honest target:
             the forecast knows the month, not the budget's id. -->
        @if (hasBudget() && !hasError()) {
          <button
            matButton
            class="shrink-0"
            [attr.aria-label]="'currentMonth.viewNextMonthBudget' | transloco"
            (click)="navigateToBudgets.emit()"
          >
            {{ 'currentMonth.viewBudgets' | transloco }}
          </button>
        }
      </div>

      <div
        class="bg-surface-container-low rounded-3xl p-5 flex-1 flex flex-col justify-center"
      >
        <!-- The failure belongs inside this card, not instead of it. Rendered
             as a standalone outlined card, it announced "different subsystem"
             from a grid cell whose neighbour was built from the house header +
             panel recipe — and it dropped the month it was failing about. Both
             charts already carry their own error this way. -->
        @if (hasError()) {
          <div
            class="flex flex-col items-center justify-center text-center gap-2 py-4"
            data-testid="next-month-error"
          >
            <div
              class="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >cloud_off</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.nextMonthErrorTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.nextMonthErrorMessage' | transloco }}
            </p>
            <button
              matButton="outlined"
              class="mt-2"
              data-testid="next-month-retry"
              (click)="retry.emit()"
            >
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        } @else if (hasBudget()) {
          <p class="text-body-medium text-on-surface-variant text-center">
            {{ 'currentMonth.nextMonthEstimatedRollover' | transloco }}
            <span
              class="font-bold tabular-nums ph-no-capture"
              [class]="
                estimatedRollover() >= 0
                  ? 'text-financial-savings'
                  : 'text-financial-negative'
              "
            >
              {{ estimatedRollover() | appCurrency: currency() : '1.0-0' }}
            </span>
          </p>
        } @else {
          <div class="flex flex-col items-center justify-center gap-3 py-4">
            <div
              class="w-16 h-16 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >event_busy</mat-icon
              >
            </div>
            <h3
              class="text-title-medium font-medium text-on-surface-variant text-center"
            >
              {{
                'currentMonth.nextMonthNoBudget'
                  | transloco: { month: monthName() }
              }}
            </h3>
            <button matButton="outlined" (click)="navigateToBudgets.emit()">
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'currentMonth.nextMonthAnticipate' | transloco }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardNextMonth {
  readonly #monthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    month: 'long',
  });

  readonly forecast = input.required<UpcomingMonthForecast>();
  readonly estimatedRollover = input.required<number>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly hasError = input(false);

  readonly navigateToBudgets = output<void>();
  readonly retry = output<void>();

  protected readonly monthName = computed(() => {
    const f = this.forecast();
    return this.#monthFormatter.format(new Date(f.year, f.month - 1, 1));
  });

  protected readonly hasBudget = computed(() => this.forecast().hasBudget);
}
