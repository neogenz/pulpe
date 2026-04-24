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
import { CURRENCY_CONFIG } from '@core/currency';

const ROLLOVER_FORMATTERS = new Map<string, Intl.NumberFormat>();

function getRolloverFormatter(locale: string): Intl.NumberFormat {
  let formatter = ROLLOVER_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    ROLLOVER_FORMATTERS.set(locale, formatter);
  }
  return formatter;
}

@Component({
  selector: 'pulpe-dashboard-next-month',
  imports: [MatIconModule, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0!"
        >
          <mat-icon aria-hidden="true">event_upcoming</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            {{ 'currentMonth.nextMonthTitle' | transloco }}
          </h2>
          <p
            class="text-body-small text-on-surface-variant font-medium mt-0.5 capitalize"
          >
            {{ monthName() }} {{ forecast().year }}
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl p-5 flex-1 flex flex-col justify-center"
      >
        @if (hasBudget()) {
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
              {{ formattedRollover() }} {{ currency() }}
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

  readonly navigateToBudgets = output<void>();

  protected readonly monthName = computed(() => {
    const f = this.forecast();
    return this.#monthFormatter.format(new Date(f.year, f.month - 1, 1));
  });

  protected readonly hasBudget = computed(() => this.forecast().hasBudget);

  protected readonly formattedRollover = computed(() => {
    const locale = CURRENCY_CONFIG[this.currency()].numberLocale;
    return getRolloverFormatter(locale).format(this.estimatedRollover());
  });
}
