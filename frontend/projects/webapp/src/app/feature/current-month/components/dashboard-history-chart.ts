import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import {} from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  Chart,
  type ChartConfiguration,
  type ChartData,
  registerables,
} from 'chart.js';

import type { HistoryDataPoint } from '../services/dashboard-store';

Chart.register(...registerables);

@Component({
  selector: 'pulpe-dashboard-history-chart',
  imports: [BaseChartDirective, MatIconModule],
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>bar_chart</mat-icon>
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
              [options]="chartOptions"
              [type]="chartType"
            ></canvas>
          </div>
        } @else {
          <div
            class="flex items-center justify-center text-body-medium text-on-surface-variant h-full"
          >
            Pas assez de données pour afficher l'historique.
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
  readonly history = input.required<HistoryDataPoint[]>();

  readonly chartType = 'bar' as const;

  readonly #incomeColor = signal('#10b981');
  readonly #expenseColor = signal('#d97706');
  readonly #savingsColor = signal('#406741');

  constructor() {
    afterNextRender(() => {
      const primary = this.#resolveColor('var(--mat-sys-primary)');
      const secondary = this.#resolveColor('var(--mat-sys-secondary)');
      if (primary) this.#incomeColor.set(primary);
      if (secondary) this.#savingsColor.set(secondary);
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

  readonly hasData = computed(() => this.history().length > 0);

  readonly chartData = computed<ChartData<'bar', number[], string>>(() => {
    const data = this.history();
    const formatter = new Intl.DateTimeFormat('fr-CH', { month: 'short' });
    const hasSavingsData = data.some((d) => d.savings > 0);

    const datasets: ChartData<'bar', number[], string>['datasets'] = [
      {
        data: data.map((d) => d.income),
        label: 'Revenus',
        backgroundColor: this.#incomeColor(),
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
      {
        data: data.map((d) => d.expenses),
        label: 'Dépenses',
        backgroundColor: this.#expenseColor(),
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ];

    if (hasSavingsData) {
      datasets.push({
        data: data.map((d) => d.savings),
        label: 'Épargne',
        backgroundColor: this.#savingsColor(),
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
        borderColor: this.#incomeColor() + '60',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: 'transparent',
      } as never);
    }

    return {
      labels: data.map((d) => {
        const date = new Date(d.year, d.month - 1, 1);
        const name = formatter.format(date);
        return name.charAt(0).toUpperCase() + name.slice(1);
      }),
      datasets,
    };
  });

  readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
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
            family: 'Outfit, sans-serif',
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(28, 27, 31, 0.9)',
        titleFont: { family: 'Outfit, sans-serif' },
        bodyFont: { family: 'Outfit, sans-serif' },
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('de-CH', {
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
        display: true,
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          font: {
            family: 'Outfit, sans-serif',
          },
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
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
            family: 'Outfit, sans-serif',
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };
}
