import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { FinancialKindDirective } from '@ui/financial-kind';
import type { BudgetLineConsumption } from '@core/budget/budget-line-consumption';
import type { BudgetLine, SupportedCurrency } from 'pulpe-shared';
import { CURRENCY_CONFIG } from '@core/currency';

const MAX_VISIBLE_FORECASTS = 5;

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  imports: [
    MatButtonModule,
    MatRipple,
    MatIconModule,
    DecimalPipe,
    FinancialKindDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
          >
            <mat-icon aria-hidden="true">checklist</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.uncheckedForecasts.title' | transloco }}
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              {{
                'currentMonth.uncheckedForecasts.count'
                  | transloco: { count: forecasts().length }
              }}
            </p>
          </div>
        </div>
        @if (hasMore()) {
          <button matButton (click)="viewBudget.emit()">
            {{ 'common.viewAll' | transloco }}
          </button>
        }
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (forecasts().length > 0) {
          <div class="flex flex-col gap-1">
            @for (forecast of displayedForecasts(); track forecast.id) {
              @let displayAmount =
                consumptions().get(forecast.id)?.remaining ?? forecast.amount;
              @let isChecking = checkingIds().has(forecast.id);
              <div
                class="relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl hover:bg-on-surface/8 motion-safe:transition-colors"
                [class.checking]="isChecking"
              >
                <button
                  class="flex-shrink-0 flex items-center justify-center w-11 h-11 -m-2 rounded-full cursor-pointer"
                  matRipple
                  [matRippleCentered]="true"
                  (click)="toggleCheck.emit(forecast.id)"
                  [attr.aria-label]="
                    'currentMonth.uncheckedForecasts.toggleAriaLabel'
                      | transloco
                        : { name: forecast.name, amount: displayAmount }
                  "
                >
                  <mat-icon
                    [class.text-primary]="isChecking"
                    [class.icon-filled]="isChecking"
                    aria-hidden="true"
                  >
                    {{ isChecking ? 'check_circle' : 'radio_button_unchecked' }}
                  </mat-icon>
                </button>
                <span
                  class="text-body-medium font-bold text-on-surface truncate flex-1 min-w-0 ph-no-capture"
                >
                  {{ forecast.name }}
                </span>
                <span
                  class="text-label-large whitespace-nowrap font-semibold tabular-nums ph-no-capture"
                  [pulpeFinancialKind]="forecast.kind"
                >
                  {{ displayAmount | number: '1.2-2' : locale() }}
                  {{ currency() }}
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-financial-income/10 text-financial-income flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >done_all</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'dashboard.allUpToDate' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{
                'currentMonth.uncheckedForecasts.allCheckedMessage' | transloco
              }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    @keyframes forecast-check-exit {
      0%,
      30% {
        opacity: 1;
        transform: translateX(0);
      }
      100% {
        opacity: 0;
        transform: translateX(1rem);
      }
    }

    .checking {
      animation: forecast-check-exit 500ms var(--pulpe-ease-emphasized) forwards;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .checking {
        animation: none;
        opacity: 0.5;
      }
    }
  `,
})
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  readonly consumptions = input(new Map<string, BudgetLineConsumption>());
  readonly checkingIds = input(new Set<string>());
  readonly currency = input<SupportedCurrency>('CHF');
  readonly toggleCheck = output<string>();
  readonly viewBudget = output<void>();

  protected readonly hasMore = computed(
    () => this.forecasts().length > MAX_VISIBLE_FORECASTS,
  );

  protected readonly locale = computed(
    () => CURRENCY_CONFIG[this.currency()].locale,
  );

  protected readonly displayedForecasts = computed(() =>
    this.forecasts().slice(0, MAX_VISIBLE_FORECASTS),
  );
}
