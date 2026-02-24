import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { MatIconModule } from '@angular/material/icon';
import { type ChartConfiguration } from 'chart.js';
import type { HistoryDataPoint } from '../services/dashboard-state';
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
  selector: 'pulpe-dashboard-history-chart',
  imports: [BaseChartDirective, MatIconModule],
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon aria-hidden="true">bar_chart</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            Historique
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            Revenus, dépenses et épargne
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
        } @else {
          <div
            class="flex flex-col items-center justify-center text-center h-full gap-2 p-6"
          >
            <mat-icon
              class="text-on-surface-variant/50 mb-2 empty-state-icon"
              aria-hidden="true"
              >bar_chart</mat-icon
            >
            <p class="text-body-medium text-on-surface-variant">
              Pas assez de données pour afficher l'historique.
            </p>
            <p class="text-body-small text-on-surface-variant/70">
              L'historique apparaitra avec tes prochains budgets.
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

    .empty-state-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHistoryChart {
  readonly #doc = inject(DOCUMENT);
  readonly history = input.required<HistoryDataPoint[]>();

  readonly chartType = 'bar' as const;

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

  readonly chartData = computed<ChartConfiguration['data']>(() => {
    const data = this.history();
    const theme = this.#theme();
    const hasSavingsData = data.some((d) => d.savings > 0);

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        data: data.map((d) => d.income),
        label: 'Revenus',
        backgroundColor: theme?.income ?? '',
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
      {
        data: data.map((d) => d.expenses),
        label: 'Dépenses',
        backgroundColor: theme?.expense ?? '',
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ];

    if (hasSavingsData) {
      datasets.push({
        data: data.map((d) => d.savings),
        label: 'Épargne',
        backgroundColor: theme?.savings ?? '',
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
        label: 'Revenu moyen',
        borderColor: colorWithAlpha(theme?.income ?? '', 0.38),
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: 'transparent',
      });
    }

    return {
      labels: data.map((d) => formatShortMonth(d.month)),
      datasets,
    };
  });

  readonly chartOptions = computed<ChartConfiguration['options']>(() => {
    const theme = this.#theme();
    const tickColor = theme?.tickColor || undefined;
    const gridColor = theme?.gridColor || undefined;
    const tooltipBg = theme?.tooltipBg || undefined;

    return {
      responsive: true,
      maintainAspectRatio: false,
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
                label += formatCHF(context.parsed.y);
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
