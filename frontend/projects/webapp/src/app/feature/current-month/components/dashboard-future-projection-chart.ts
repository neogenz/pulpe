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
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartType } from 'chart.js';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import {
  type ChartThemeColors,
  resolveChartThemeColors,
  registerChartPlugins,
  formatShortMonth,
} from '../utils/chart-utils';
import {
  buildProjectionChartOptions,
  buildProjectionChartData,
} from './dashboard-projection-chart.config';

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
            <div
              class="w-16 h-16 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >show_chart</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              Aucun budget futur défini
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              Crée tes prochains budgets pour voir ta projection ici.
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
  readonly forecasts = input.required<UpcomingMonthForecast[]>();

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

  readonly missingMonthsLabel = computed(() =>
    this.forecasts()
      .filter((f) => !f.hasBudget)
      .map((f) => `${formatShortMonth(f.month)} ${f.year}`)
      .join(', '),
  );

  readonly chartType: ChartType = 'line';

  readonly chartOptions = computed(() =>
    buildProjectionChartOptions(this.#theme()),
  );

  readonly chartData = computed(() =>
    buildProjectionChartData(this.forecasts(), this.#theme()),
  );
}
