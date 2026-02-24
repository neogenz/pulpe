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
import {
  Chart,
  type ChartConfiguration,
  type ChartType,
  registerables,
} from 'chart.js';
import type { UpcomingMonthForecast } from '../services/dashboard-store';

Chart.register(...registerables);

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
          <mat-icon>trending_up</mat-icon>
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
              [options]="chartOptions"
              [type]="chartType"
            ></canvas>
          </div>
          @if (missingMonthsCount() > 0) {
            <div
              class="flex items-center gap-2 mt-3 px-2 py-2 rounded-xl bg-surface-container-low cursor-help"
              [matTooltip]="'Mois manquants : ' + missingMonthsLabel()"
              matTooltipPosition="above"
            >
              <mat-icon class="text-on-surface-variant shrink-0"
                >info_outline</mat-icon
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
            <mat-icon class="text-on-surface-variant/50 scale-150 mb-2"
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
    `,
  ],
})
export class DashboardFutureProjectionChart {
  readonly forecasts = input.required<UpcomingMonthForecast[]>();

  readonly #balanceLineColor = signal('#0061A6');
  readonly #balanceFillColor = signal('rgba(0, 97, 166, 0.15)');
  readonly #savingsLineColor = signal('#006E25');
  readonly #savingsFillColor = signal('rgba(0, 110, 37, 0.10)');
  readonly #negativeFillColor = signal('rgba(186, 26, 26, 0.15)');

  constructor() {
    afterNextRender(() => {
      const tertiary = this.#resolveColor('var(--pulpe-financial-income)');
      if (tertiary) {
        this.#balanceLineColor.set(tertiary);
        this.#balanceFillColor.set(
          tertiary.replace('rgb(', 'rgba(').replace(')', ', 0.15)'),
        );
      }
      const primary = this.#resolveColor('var(--pulpe-financial-savings)');
      if (primary) {
        this.#savingsLineColor.set(primary);
        this.#savingsFillColor.set(
          primary.replace('rgb(', 'rgba(').replace(')', ', 0.10)'),
        );
      }
      const negative = this.#resolveColor('var(--pulpe-financial-negative)');
      if (negative) {
        this.#negativeFillColor.set(
          negative.replace('rgb(', 'rgba(').replace(')', ', 0.15)'),
        );
      }
    });
  }

  #resolveColor(cssValue: string): string {
    const el = document.createElement('div');
    el.style.color = cssValue;
    el.style.display = 'none';
    document.body.appendChild(el);
    const resolved = getComputedStyle(el).color;
    document.body.removeChild(el);
    return resolved;
  }

  readonly hasData = computed(() => {
    const data = this.forecasts();
    return data && data.length > 0 && data.some((f) => f.hasBudget);
  });

  readonly missingMonthsCount = computed(
    () => this.forecasts().filter((f) => !f.hasBudget).length,
  );

  readonly missingMonthsLabel = computed(() =>
    this.forecasts()
      .filter((f) => !f.hasBudget)
      .map((f) => `${this.#getMonthName(f.month)} ${f.year}`)
      .join(', '),
  );

  readonly chartType: ChartType = 'line';

  readonly chartOptions: ChartConfiguration['options'] = {
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
          font: { family: 'Outfit, sans-serif' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, family: 'Outfit, sans-serif' },
        bodyFont: { size: 14, family: 'Outfit, sans-serif', weight: 'bold' },
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
              label += new Intl.NumberFormat('fr-CH', {
                style: 'currency',
                currency: 'CHF',
              }).format(context.parsed.y);
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
            family: 'Outfit, sans-serif',
            size: 11,
          },
          color: '#737373',
        },
      },
      y: {
        grid: {
          color: '#f5f5f5',
        },
        ticks: {
          font: {
            family: 'Outfit, sans-serif',
            size: 11,
          },
          color: '#737373',
          callback: function (value: string | number) {
            return Number(value) / 1000 + 'k';
          },
        },
      },
    },
  };

  readonly chartData = computed<ChartConfiguration['data']>(() => {
    const withBudget = this.forecasts().filter((f) => f.hasBudget);

    if (withBudget.length === 0) {
      return { datasets: [], labels: [] };
    }

    // Disponible par mois = income - expenses - savings (même formule que le backend sparse)
    const balanceData = withBudget.map(
      (f) => (f.income || 0) - (f.expenses || 0) - (f.savings || 0),
    );

    // Cumulative savings
    let cumulativeSavings = 0;
    const savingsData: number[] = [];
    const hasSavings = withBudget.some((f) => (f.savings || 0) > 0);
    for (const f of withBudget) {
      cumulativeSavings += f.savings || 0;
      savingsData.push(cumulativeSavings);
    }

    const balanceLineColor = this.#balanceLineColor();
    const balanceFillColor = this.#balanceFillColor();
    const negativeFillColor = this.#negativeFillColor();

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        data: balanceData,
        label: 'Disponible',
        borderColor: balanceLineColor,
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
        pointBackgroundColor: balanceLineColor,
        pointBorderColor: balanceLineColor,
      },
    ];

    if (hasSavings) {
      datasets.push({
        data: savingsData,
        label: 'Épargne cumulée',
        borderColor: this.#savingsLineColor(),
        backgroundColor: this.#savingsFillColor(),
        fill: true,
        pointBackgroundColor: this.#savingsLineColor(),
        borderDash: [6, 4],
        borderWidth: 2,
      } as ChartConfiguration['data']['datasets'][number]);
    }

    return {
      labels: withBudget.map((f) => this.#getMonthName(f.month)),
      datasets,
    };
  });

  #getMonthName(monthNumber: number): string {
    const date = new Date(2000, monthNumber - 1, 1);
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(
      date,
    );
    return month.charAt(0).toUpperCase() + month.slice(1);
  }
}
