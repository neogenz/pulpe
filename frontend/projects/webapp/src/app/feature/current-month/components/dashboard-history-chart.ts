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
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { DOCUMENT } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BaseChartDirective } from 'ng2-charts';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type ChartConfiguration } from 'chart.js';
import type { HistoryDataPoint } from '../services/dashboard-state';
import { UserSettingsStore } from '@core/user-settings';
import {
  type ChartThemeColors,
  resolveChartThemeColors,
  registerChartPlugins,
  colorWithAlpha,
  formatShortMonth,
  formatCurrency,
  CHART_FONT_FAMILY,
  resolveChartAnimation,
} from '@core/chart/chart-theme';

@Component({
  selector: 'pulpe-dashboard-history-chart',
  imports: [BaseChartDirective, MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0"
        >
          <mat-icon aria-hidden="true">bar_chart</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            {{ 'currentMonth.historyTitle' | transloco }}
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            {{ 'currentMonth.historySubtitle' | transloco }}
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl py-4 px-4 flex-1 flex flex-col justify-center min-h-[300px]"
      >
        <!-- The failure is asked about first, and the empty state last, on its
             own evidence rather than on the negation of the other two. hasData
             also waits on the theme, which only resolves in afterNextRender, so
             a trailing @else claimed "Pas encore d'historique" for one frame to
             every user who has six months of it — "not yet painted" rendered as
             "you have nothing", the exact conflation the error branch below
             exists to undo. That frame now draws an empty panel instead. -->
        @if (hasError()) {
          <!-- "Pas encore d'historique" was shown here whether the user had no
               history or the request for it failed, because a failed fetch
               reaches this component as the same empty array. Told he had no
               past, a user with six months of it has no reason to retry — and
               no way to, since the page's own reload button lives in a header
               far above this card. -->
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <div
              class="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150" aria-hidden="true"
                >cloud_off</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.historyErrorTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.historyErrorMessage' | transloco }}
            </p>
            <button
              matButton="outlined"
              class="mt-2"
              data-testid="history-chart-retry"
              (click)="retry.emit()"
            >
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        } @else if (hasData()) {
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
        } @else if (isEmpty()) {
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <div
              class="w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150" aria-hidden="true"
                >bar_chart</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.historyEmptyTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.historyEmptyMessage' | transloco }}
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHistoryChart {
  readonly #doc = inject(DOCUMENT);
  readonly #amountsVisibility = inject(AmountsVisibilityService);
  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly history = input.required<HistoryDataPoint[]>();
  readonly hasError = input(false);
  readonly retry = output<void>();

  readonly chartType = 'bar' as const;

  readonly #historyIncomeLabel = this.#transloco.translate(
    'currentMonth.historyIncomeLabel',
  );
  readonly #historyExpensesLabel = this.#transloco.translate(
    'currentMonth.historyExpensesLabel',
  );
  readonly #historySavingsLabel = this.#transloco.translate(
    'currentMonth.historySavingsLabel',
  );
  readonly #historyAvgIncomeLabel = this.#transloco.translate(
    'currentMonth.historyAvgIncomeLabel',
  );

  readonly #theme = signal<ChartThemeColors | null>(null);

  constructor() {
    afterNextRender(() => {
      registerChartPlugins();
      this.#theme.set(resolveChartThemeColors(this.#doc));
    });
  }

  readonly hasData = computed(
    () => this.#theme() !== null && this.history().length > 0,
  );

  readonly isEmpty = computed(() => this.history().length === 0);

  readonly chartData = computed<ChartConfiguration['data']>(() => {
    const data = this.history();
    const theme = this.#theme();
    const hasSavingsData = data.some((d) => d.savings > 0);

    // The last column is the month the reader is standing in, and it is short
    // however many days are left in it. At the weight of the five finished
    // months beside it, a partial total reads as spending going down. The
    // subtitle has always said the month is not over and the aria-label says it
    // too; this is the sighted reader being told the same thing.
    //
    // 0.8 and no lighter. Amber is the tightest of the three hues, and against
    // this panel it composites to 3.29:1 here — WCAG asks 3:1 of a graphic that
    // carries meaning, and 0.7 would drop it to 2.79. A column faint enough to
    // miss is a worse lie than one that overstates.
    const dimCurrentMonth = (color: string) =>
      data.map((_, index) =>
        index === data.length - 1 ? colorWithAlpha(color, 0.8) : color,
      );

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        data: data.map((d) => d.income),
        label: this.#historyIncomeLabel,
        backgroundColor: dimCurrentMonth(theme?.income ?? ''),
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
      {
        data: data.map((d) => d.expenses),
        label: this.#historyExpensesLabel,
        backgroundColor: dimCurrentMonth(theme?.expense ?? ''),
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ];

    if (hasSavingsData) {
      datasets.push({
        data: data.map((d) => d.savings),
        label: this.#historySavingsLabel,
        backgroundColor: dimCurrentMonth(theme?.savings ?? ''),
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      });
    }

    if (data.length > 0) {
      const avgIncome =
        data.reduce((sum, d) => sum + d.income, 0) / data.length;
      datasets.push({
        type: 'line',
        data: Array(data.length).fill(avgIncome),
        label: this.#historyAvgIncomeLabel,
        borderColor: colorWithAlpha(theme?.income ?? '', 0.38),
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: 'transparent',
      });
    }

    return {
      labels: data.map((d) => formatShortMonth(d.month, this.#locale)),
      datasets,
    };
  });

  // Mirrors what the bars and the dashed line draw — the three series, the
  // average the line marks, and the latest month, which is the point a sighted
  // reader lands on first.
  protected readonly chartAriaLabel = computed(() => {
    const data = this.history();
    if (data.length === 0) return '';
    const currency = this.#userSettings.currency();
    const last = data[data.length - 1];

    return this.#transloco.translate('currentMonth.historyChartAria', {
      count: data.length,
      first: formatShortMonth(data[0].month, this.#locale),
      last: formatShortMonth(last.month, this.#locale),
      avgIncome: formatCurrency(
        data.reduce((sum, d) => sum + d.income, 0) / data.length,
        currency,
      ),
      lastIncome: formatCurrency(last.income, currency),
      lastExpenses: formatCurrency(last.expenses, currency),
      lastSavings: formatCurrency(last.savings, currency),
    });
  });

  readonly chartOptions = computed<ChartConfiguration['options']>(() => {
    const theme = this.#theme();
    const isHidden = this.#amountsVisibility.amountsHidden();
    const currency = this.#userSettings.currency();
    const tickColor = theme?.tickColor || undefined;
    const gridColor = theme?.gridColor || undefined;
    const tooltipBg = theme?.tooltipBg || undefined;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: resolveChartAnimation(),
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            font: {
              family: CHART_FONT_FAMILY,
            },
            color: tickColor,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: tooltipBg,
          titleFont: { family: CHART_FONT_FAMILY },
          bodyFont: { family: CHART_FONT_FAMILY },
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += isHidden
                  ? '•••••'
                  : formatCurrency(context.parsed.y, currency);
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            font: {
              family: CHART_FONT_FAMILY,
            },
            color: tickColor,
          },
        },
        y: {
          display: true,
          grid: {
            color: gridColor,
          },
          border: {
            display: false,
            dash: [4, 4],
          },
          ticks: {
            callback: (value) => {
              if (isHidden) return '•';
              if (typeof value === 'number') {
                if (value >= 1000) return value / 1000 + 'k';
                return value;
              }
              return value;
            },
            font: {
              family: CHART_FONT_FAMILY,
            },
            color: tickColor,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
    };
  });
}
