import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { type Chart, type ChartConfiguration, type ChartType } from 'chart.js';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import {
  type ChartThemeColors,
  resolveChartThemeColors,
  registerChartPlugins,
  colorWithAlpha,
  formatShortMonth,
  formatCHF,
  CHART_FONT_FAMILY,
} from '../utils/chart-utils';

@Component({
  selector: 'pulpe-dashboard-future-projection-chart',
  imports: [MatIconModule, MatTooltipModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full w-full">
      <div class="flex items-center gap-3 mb-6">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon aria-hidden="true">trending_up</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface mb-0">
            Projection du solde
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            Disponible et épargne par mois futur
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl py-4 px-4 flex-1 flex flex-col justify-center min-h-[300px]"
      >
        @if (hasData()) {
          <div class="flex-1 relative w-full h-full">
            <canvas
              baseChart
              [data]="chartData()"
              [options]="chartOptions()"
              [type]="chartType"
            ></canvas>
          </div>
          @if (missingMonthsCount() > 0) {
            <div
              class="flex items-center gap-2 mt-3 px-2 py-2 rounded-xl bg-surface-container-low cursor-help"
              [matTooltip]="'Mois manquants : ' + missingMonthsLabel()"
              matTooltipPosition="above"
            >
              <mat-icon
                class="text-on-surface-variant shrink-0"
                aria-hidden="true"
                >info</mat-icon
              >
              <p class="text-body-small text-on-surface-variant">
                {{ missingMonthsCount() }} mois sans budget — crée-les pour
                affiner ta projection.
              </p>
            </div>
          }
        } @else {
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <mat-icon
              class="text-on-surface-variant/50 mb-2 empty-state-icon"
              aria-hidden="true"
              >show_chart</mat-icon
            >
            <p class="text-body-medium text-on-surface-variant">
              Aucun budget futur défini pour le moment.
            </p>
            <p class="text-body-small text-on-surface-variant/70">
              Crée tes prochains budgets pour voir ta projection ici.
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .empty-state-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }
    `,
  ],
})
export class DashboardFutureProjectionChart {
  readonly forecasts = input.required<UpcomingMonthForecast[]>();

  readonly #theme = signal<ChartThemeColors | null>(null);

  constructor() {
    afterNextRender(() => {
      registerChartPlugins();
      this.#theme.set(resolveChartThemeColors());
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

  readonly missingMonthsLabel = computed(() =>
    this.forecasts()
      .filter((f) => !f.hasBudget)
      .map((f) => `${formatShortMonth(f.month)} ${f.year}`)
      .join(', '),
  );

  readonly chartType: ChartType = 'line';

  readonly chartOptions = computed<ChartConfiguration['options']>(() => {
    const theme = this.#theme();
    const tickColor = theme?.tickColor || undefined;
    const gridColor = theme?.gridColor || undefined;
    const tooltipBg = theme?.tooltipBg || undefined;

    return {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        line: {
          tension: 0.4,
          borderWidth: 3,
        },
        point: {
          radius: 4,
          hoverRadius: 6,
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            font: { family: CHART_FONT_FAMILY },
            color: tickColor,
          },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          padding: 12,
          titleFont: { size: 14, family: CHART_FONT_FAMILY },
          bodyFont: { size: 14, family: CHART_FONT_FAMILY, weight: 'bold' },
          displayColors: true,
          callbacks: {
            label: function (context: {
              dataset: { label?: string };
              parsed: { y: number | null };
            }) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatCHF(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: CHART_FONT_FAMILY,
              size: 11,
            },
            color: tickColor,
          },
        },
        y: {
          grid: {
            color: gridColor,
          },
          ticks: {
            font: {
              family: CHART_FONT_FAMILY,
              size: 11,
            },
            color: tickColor,
            callback: function (value: string | number) {
              return Number(value) / 1000 + 'k';
            },
          },
        },
      },
    };
  });

  readonly chartData = computed<ChartConfiguration['data']>(() => {
    const withBudget = this.forecasts().filter((f) => f.hasBudget);
    const theme = this.#theme();

    if (withBudget.length === 0 || !theme) {
      return { datasets: [], labels: [] };
    }

    const balanceData = withBudget.map(
      (f) => (f.income || 0) - (f.expenses || 0) - (f.savings || 0),
    );

    let cumulativeSavings = 0;
    const savingsData: number[] = [];
    const hasSavings = withBudget.some((f) => (f.savings || 0) > 0);
    for (const f of withBudget) {
      cumulativeSavings += f.savings || 0;
      savingsData.push(cumulativeSavings);
    }

    const balanceFillColor = colorWithAlpha(theme.income, 0.15);
    const negativeFillColor = colorWithAlpha(theme.negative, 0.15);

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        data: balanceData,
        label: 'Disponible',
        borderColor: theme.income,
        fill: 'origin',
        backgroundColor: ((context: { chart: Chart }) => {
          const yScale = context.chart.scales['y'];
          const chartArea = context.chart.chartArea;
          if (!yScale || !chartArea || !chartArea.bottom) {
            return balanceFillColor;
          }
          const zeroY = yScale.getPixelForValue(0);
          const gradient = context.chart.ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          );
          const ratio = Math.max(
            0,
            Math.min(
              1,
              (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top),
            ),
          );
          gradient.addColorStop(0, balanceFillColor);
          gradient.addColorStop(ratio, balanceFillColor);
          gradient.addColorStop(ratio, negativeFillColor);
          gradient.addColorStop(1, negativeFillColor);
          return gradient;
        }) as unknown as string,
        pointBackgroundColor: theme.income,
        pointBorderColor: theme.income,
      },
    ];

    if (hasSavings) {
      datasets.push({
        data: savingsData,
        label: 'Épargne cumulée',
        borderColor: theme.savings,
        backgroundColor: colorWithAlpha(theme.savings, 0.1),
        fill: true,
        pointBackgroundColor: theme.savings,
        borderDash: [6, 4],
        borderWidth: 2,
      } as ChartConfiguration['data']['datasets'][number]);
    }

    return {
      labels: withBudget.map((f) => formatShortMonth(f.month)),
      datasets,
    };
  });
}
