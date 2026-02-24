import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration, ChartType } from 'chart.js';
import type { UpcomingMonthForecast } from '../services/dashboard-store';

@Component({
  selector: 'pulpe-dashboard-future-projection-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, BaseChartDirective],
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
            Évolution prévisionnelle (Revenus - Dépenses)
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
              <mat-icon class="text-on-surface-variant text-[18px]"
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

  readonly #lineColor = signal('#0061A6');
  readonly #fillColor = signal('rgba(0, 97, 166, 0.15)');

  constructor() {
    afterNextRender(() => {
      const tertiary = this.#resolveColor('var(--mat-sys-tertiary)');
      if (tertiary) {
        this.#lineColor.set(tertiary);
        // Convert rgb() to rgba() with 15% opacity for the fill
        this.#fillColor.set(
          tertiary.replace('rgb(', 'rgba(').replace(')', ', 0.15)'),
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
      .map((f) => `${this.getMonthName(f.month)} ${f.year}`)
      .join(', '),
  );

  public chartType: ChartType = 'line';

  public chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: {
        tension: 0.4, // Smooth curves
        borderWidth: 3,
      },
      point: {
        radius: 4,
        hoverRadius: 6,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, family: 'sans-serif' },
        bodyFont: { size: 14, family: 'sans-serif', weight: 'bold' },
        displayColors: false,
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
            family: 'sans-serif',
            size: 11,
          },
          color: '#737373', // tailwind neutral-500
        },
      },
      y: {
        grid: {
          color: '#f5f5f5', // very light gray
        },
        ticks: {
          font: {
            family: 'sans-serif',
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

    return {
      labels: withBudget.map((f) => this.getMonthName(f.month)),
      datasets: [
        {
          data: withBudget.map((f) => (f.income || 0) - (f.expenses || 0)),
          label: 'Solde Projeté',
          borderColor: this.#lineColor(),
          backgroundColor: this.#fillColor(),
          fill: true,
          pointBackgroundColor: this.#lineColor(),
        },
      ],
    };
  });

  getMonthName(monthNumber: number): string {
    const date = new Date(2000, monthNumber - 1, 1);
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(
      date,
    );
    // capitalize first letter
    return month.charAt(0).toUpperCase() + month.slice(1);
  }
}
