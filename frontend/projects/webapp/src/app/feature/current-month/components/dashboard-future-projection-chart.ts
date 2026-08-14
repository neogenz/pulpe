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
import { MatButtonModule } from '@angular/material/button';
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
  formatCurrencyForAria,
} from '@core/chart/chart-theme';
import {
  buildProjectionChartOptions,
  buildProjectionChartData,
} from './dashboard-projection-chart.config';

@Component({
  selector: 'pulpe-dashboard-future-projection-chart',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    BaseChartDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full w-full">
      <!-- Same header string as the chart stacked directly under it: the two
           badges started 4px apart horizontally and their panels aligned
           exactly, so the misalignment read as a rendering fault. -->
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0"
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
        <!-- Same order as the history chart below, and for the same reason:
             the failure is asked about first, and the empty state last, on its
             own evidence rather than on the negation of the other two. hasData
             also waits on the theme, which only resolves in afterNextRender, so
             a trailing @else told every user with months already planned to
             "crée tes prochains budgets" for one frame. -->
        @if (hasError()) {
          <!-- Both this card and the history chart below read the same failed
               request as an empty list, so one dropped connection used to
               produce two calm sentences telling the user he had planned
               nothing — and "Crée tes prochains budgets" invited him to
               recreate months that already exist. -->
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <div
              class="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >cloud_off</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.projectionErrorTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.projectionErrorMessage' | transloco }}
            </p>
            <button
              matButton="outlined"
              class="mt-2"
              data-testid="projection-chart-retry"
              (click)="retry.emit()"
            >
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        } @else if (hasData()) {
          <div class="flex-1 relative w-full h-full">
            <!-- A bare <canvas> is absent from the accessibility tree: the
                 product's own differentiator did not exist without sight. -->
            <!-- The label spells out the figures the ticks and tooltips
                 are careful to mask, and posthog-js blocks an element from
                 the replay only by this class — an attribute is serialized
                 whole, so the amounts were travelling in the one part of the
                 chart rrweb does record. The amounts-visible class keeps
                 the blur rule that shares ph-no-capture off a chart that
                 already masks itself. -->
            <canvas
              baseChart
              role="img"
              class="ph-no-capture amounts-visible"
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
              class="flex items-center gap-2 mt-3 px-2 py-2 w-full text-start rounded-xl cursor-pointer bg-surface-container hover:bg-on-surface/8 motion-safe:transition-colors"
              [matTooltip]="missingMonthsTooltip()"
              matTooltipPosition="above"
              (click)="createMissingBudgets.emit()"
              data-testid="projection-missing-budgets-button"
            >
              <!-- add, not info: the copy says "crée-les", and an information
                   glyph on a surface the same colour as its parent was the
                   only thing this control offered a mouse user. The icon was
                   half the fix. The surface was the other half: at
                   surface-container-low this measured the same
                   rgb(240,245,235) as the panel it sits in, borderless, and
                   Tailwind's own reset left it on cursor: default. One tonal
                   step up is all a button needs to look like one. -->
              <mat-icon
                class="text-on-surface-variant shrink-0"
                aria-hidden="true"
                >add</mat-icon
              >
              <!-- Eleven of the next twelve months planned leaves one, and
                   "1 mois sans budget — crée-les" asked for a plural of a
                   single month. No plural resolver in this app: the gate is
                   the call site, as it already is on every other count on
                   this page. -->
              <span class="text-body-small text-on-surface-variant">
                @if (missingMonthsCount() === 1) {
                  {{
                    'currentMonth.projectionMissingBudgetSingular' | transloco
                  }}
                } @else {
                  {{
                    'currentMonth.projectionMissingBudget'
                      | transloco: { count: missingMonthsCount() }
                  }}
                }
              </span>
            </button>
          }
        } @else if (isEmpty()) {
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <div
              class="w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-2"
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
  readonly hasError = input(false);
  readonly createMissingBudgets = output<void>();
  readonly retry = output<void>();

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

  readonly isEmpty = computed(() => !this.forecasts().some((f) => f.hasBudget));

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

    // Same omission as the history chart: this label was the one reading of
    // the figures that did not consult the hide-amounts toggle its own ticks
    // and tooltips obey.
    if (this.#amountsVisibility.amountsHidden()) {
      return this.#transloco.translate(
        'currentMonth.projectionChartAriaHidden',
        {
          count: months.length,
          first: formatShortMonth(months[0].month, this.#locale),
          last: formatShortMonth(last.month, this.#locale),
        },
      );
    }

    return this.#transloco.translate('currentMonth.projectionChartAria', {
      count: months.length,
      first: formatShortMonth(months[0].month, this.#locale),
      last: formatShortMonth(last.month, this.#locale),
      firstBalance: formatCurrencyForAria(balanceOf(months[0]), currency),
      lastBalance: formatCurrencyForAria(balanceOf(last), currency),
      totalSavings: formatCurrencyForAria(
        months.reduce((sum, f) => sum + (f.savings ?? 0), 0),
        currency,
      ),
    });
  });
}
