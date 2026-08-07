import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { UserSettingsStore } from '@core/user-settings';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartType } from 'chart.js';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import {
  type ChartThemeColors,
  resolveChartThemeColors,
  registerChartPlugins,
  formatShortMonth,
  formatCurrency,
} from '@core/chart/chart-theme';
import {
  buildProjectionChartOptions,
  buildProjectionChartData,
} from './dashboard-projection-chart.config';

@Component({
  selector: 'pulpe-dashboard-future-projection-chart',
  imports: [MatIconModule, MatTooltipModule, BaseChartDirective, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full w-full">
      <div class="flex items-center gap-3 mb-6">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0"
        >
          <mat-icon aria-hidden="true">trending_up</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface mb-0">
            {{ 'currentMonth.projectionTitle' | transloco }}
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            {{ 'currentMonth.projectionSubtitle' | transloco }}
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl py-4 px-4 flex-1 flex flex-col justify-center min-h-[300px]"
      >
        @if (hasData()) {
          <div class="flex-1 relative w-full h-full">
            <!-- A bare <canvas> is absent from the accessibility tree: the
                 product's own differentiator did not exist without sight. -->
            <canvas
              baseChart
              role="img"
              [attr.aria-label]="chartAriaLabel()"
              [data]="chartData()"
              [options]="chartOptions()"
              [type]="chartType"
            ></canvas>
          </div>
          @if (missingMonthsCount() > 0) {
            <!-- The line says "crée-les" and used to offer no way to do it: a
                 div carrying a mouse-only tooltip. As a button it both keeps
                 the promise its own copy makes and puts the month list within
                 reach of the keyboard, since Material shows a tooltip on
                 focus. -->
            <button
              type="button"
              class="flex items-center gap-2 mt-3 px-2 py-2 w-full text-start rounded-xl bg-surface-container-low hover:bg-on-surface/8 motion-safe:transition-colors"
              [matTooltip]="missingMonthsTooltip()"
              matTooltipPosition="above"
              (click)="createMissingBudgets.emit()"
              data-testid="projection-missing-budgets-button"
            >
              <mat-icon
                class="text-on-surface-variant shrink-0"
                aria-hidden="true"
                >info</mat-icon
              >
              <span class="text-body-small text-on-surface-variant">
                {{
                  'currentMonth.projectionMissingBudget'
                    | transloco: { count: missingMonthsCount() }
                }}
              </span>
            </button>
          }
        } @else {
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <div
              class="w-16 h-16 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >show_chart</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.projectionEmptyTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.projectionEmptyMessage' | transloco }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class DashboardFutureProjectionChart {
  readonly #doc = inject(DOCUMENT);
  readonly #amountsVisibility = inject(AmountsVisibilityService);
  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly forecasts = input.required<UpcomingMonthForecast[]>();
  readonly createMissingBudgets = output<void>();

  readonly #projectionBalanceLabel = this.#transloco.translate(
    'currentMonth.projectionBalanceLabel',
  );
  readonly #projectionCumulatedSavingsLabel = this.#transloco.translate(
    'currentMonth.projectionCumulatedSavingsLabel',
  );

  readonly #theme = signal<ChartThemeColors | null>(null);

  constructor() {
    afterNextRender(() => {
      registerChartPlugins();
      this.#theme.set(resolveChartThemeColors(this.#doc));
    });
  }

  readonly hasData = computed(() => {
    const data = this.forecasts();
    return (
      this.#theme() !== null &&
      data &&
      data.length > 0 &&
      data.some((f) => f.hasBudget)
    );
  });

  readonly missingMonthsCount = computed(
    () => this.forecasts().filter((f) => !f.hasBudget).length,
  );

  protected readonly missingMonthsTooltip = computed(() => {
    const months = this.forecasts()
      .filter((f) => !f.hasBudget)
      .map((f) => `${formatShortMonth(f.month, this.#locale)} ${f.year}`)
      .join(', ');
    return this.#transloco.translate('currentMonth.projectionMissingMonths', {
      months,
    });
  });

  readonly chartType: ChartType = 'line';

  readonly chartOptions = computed(() =>
    buildProjectionChartOptions(
      this.#theme(),
      this.#amountsVisibility.amountsHidden(),
      this.#userSettings.currency(),
    ),
  );

  readonly chartData = computed(() =>
    buildProjectionChartData(this.forecasts(), this.#theme(), this.#locale, {
      available: this.#projectionBalanceLabel,
      cumulatedSavings: this.#projectionCumulatedSavingsLabel,
    }),
  );

  // Mirrors the two series `buildProjectionChartData` draws — monthly balance,
  // and savings accumulated across the window — reported at their endpoints,
  // which is what a sighted reader takes from the curve at a glance.
  protected readonly chartAriaLabel = computed(() => {
    const months = this.forecasts().filter((f) => f.hasBudget);
    if (months.length === 0) return '';
    const currency = this.#userSettings.currency();
    const balanceOf = (f: UpcomingMonthForecast) =>
      (f.income ?? 0) - (f.expenses ?? 0);
    const last = months[months.length - 1];

    return this.#transloco.translate('currentMonth.projectionChartAria', {
      count: months.length,
      first: formatShortMonth(months[0].month, this.#locale),
      last: formatShortMonth(last.month, this.#locale),
      firstBalance: formatCurrency(balanceOf(months[0]), currency),
      lastBalance: formatCurrency(balanceOf(last), currency),
      totalSavings: formatCurrency(
        months.reduce((sum, f) => sum + (f.savings ?? 0), 0),
        currency,
      ),
    });
  });
}
