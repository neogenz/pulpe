import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import type { Plugin } from 'chart.js';
import { TranslocoService } from '@jsverse/transloco';
import {
  type SavingsGoalPlanMonth,
  type SavingsPlanSimulationResult,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import {
  type ChartThemeColors,
  formatCurrency,
  registerChartPlugins,
  resolveChartThemeColors,
} from '@core/chart/chart-theme';
import {
  buildGoalProjectionChartData,
  buildGoalProjectionChartOptions,
} from './goal-projection-chart.config';
import {
  buildGoalProjectionGuidePlugin,
  findCurrentPeriodIndex,
} from './goal-projection-chart.plugin';

/**
 * « Ta trajectoire » (docs/SAVINGS.md §10.1). Read-only cumulated
 * chart: confirmed savings in green, planned projection in tertiary blue, and an
 * amber target. Switches its data source to the simulation sandbox when
 * `draft` is provided. The canvas is paired with an offscreen `aria-live`
 * sentence so screen readers get the trajectory without the visual.
 */
@Component({
  selector: 'pulpe-goal-projection-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-w-0 rounded-2xl bg-surface-container-low p-3 sm:p-4"
      data-testid="goal-projection-panel"
    >
      <div
        class="mb-1 grid min-w-0 grid-cols-3 gap-1 px-1"
        role="group"
        [attr.aria-label]="seriesGroupLabel"
        data-testid="goal-projection-summary"
      >
        @for (item of summaryItems(); track item.series) {
          <button
            type="button"
            class="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-1 text-body-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            [class.opacity-50]="isSeriesHidden(item.series)"
            [class.line-through]="isSeriesHidden(item.series)"
            [attr.aria-pressed]="!isSeriesHidden(item.series)"
            [attr.aria-label]="seriesToggleLabel(item)"
            (click)="toggleSeries(item.series)"
            [attr.data-testid]="'goal-projection-toggle-' + item.series"
          >
            @switch (item.series) {
              @case ('target') {
                <span
                  class="h-px w-5 shrink-0 bg-financial-expense"
                  aria-hidden="true"
                  data-testid="goal-projection-target-legend"
                ></span>
              }
              @case ('confirmed') {
                <span
                  class="h-0.5 w-5 shrink-0 rounded-full bg-financial-savings"
                  aria-hidden="true"
                ></span>
              }
              @case ('projection') {
                <span
                  class="w-5 shrink-0 border-t-2 border-dashed border-tertiary"
                  aria-hidden="true"
                ></span>
              }
            }
            <span class="truncate">{{ item.label }}</span>
          </button>
        }
      </div>

      <div class="relative h-[220px] min-w-0 w-full sm:h-[260px]">
        <canvas
          #chart="base-chart"
          baseChart
          aria-hidden="true"
          [data]="chartData()"
          [options]="chartOptions()"
          [plugins]="chartPlugins()"
          [type]="chartType"
        ></canvas>
      </div>

      <p
        class="ph-no-capture sr-only"
        aria-live="polite"
        data-testid="goal-projection-aria"
      >
        {{ ariaSentence() }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class GoalProjectionChart {
  readonly #doc = inject(DOCUMENT);
  readonly #locale = inject(LOCALE_ID);
  readonly #amountsVisibility = inject(AmountsVisibilityService);
  readonly #transloco = inject(TranslocoService);

  readonly months = input.required<readonly SavingsGoalPlanMonth[]>();
  readonly draft = input<SavingsPlanSimulationResult | null>(null);
  readonly targetAmount = input.required<number | null>();
  readonly currency = input.required<SupportedCurrency>();
  readonly confirmed = input.required<number>();
  readonly projected = input.required<number>();

  readonly #theme = signal<ChartThemeColors | null>(null);
  readonly #reducedMotion = signal(false);
  readonly #hiddenSeries = signal<ReadonlySet<GoalProjectionSeries>>(new Set());
  private readonly chart = viewChild<BaseChartDirective>('chart');

  readonly chartType = 'line' as const;
  protected readonly seriesGroupLabel = this.#transloco.translate(
    'savingsGoals.plan.chartSeriesLabel',
  );

  readonly #labels = {
    target: this.#transloco.translate('savingsGoals.plan.chartTarget'),
    confirmed: this.#transloco.translate('savingsGoals.plan.chartConfirmed'),
    projection: this.#transloco.translate('savingsGoals.plan.chartProjection'),
  };
  readonly #currentPeriodLabel = this.#transloco.translate(
    'savingsGoals.plan.chartCurrentPeriod',
  );

  constructor() {
    afterNextRender(() => {
      registerChartPlugins();
      this.#theme.set(resolveChartThemeColors(this.#doc));
      this.#reducedMotion.set(
        this.#doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches ?? false,
      );
    });
  }

  readonly chartOptions = computed(() =>
    buildGoalProjectionChartOptions(
      this.#theme(),
      this.#amountsVisibility.amountsHidden(),
      this.currency(),
      this.#reducedMotion(),
    ),
  );

  readonly chartData = computed(() =>
    buildGoalProjectionChartData({
      months: this.months(),
      draft: this.draft(),
      targetAmount: this.targetAmount(),
      confirmed: this.confirmed(),
      projected: this.projected(),
      theme: this.#theme(),
      locale: this.#locale,
      labels: this.#labels,
    }),
  );

  readonly chartPlugins = computed<Plugin[]>(() => {
    const theme = this.#theme();
    if (!theme) return [];

    return [
      buildGoalProjectionGuidePlugin(
        findCurrentPeriodIndex(this.months()),
        theme,
        this.#currentPeriodLabel,
      ),
    ];
  });

  protected readonly summaryItems = computed(() => {
    const items = [
      {
        series: 'confirmed' as const,
        label: this.#labels.confirmed,
      },
      {
        series: 'projection' as const,
        label: this.#labels.projection,
      },
    ];
    const targetAmount = this.targetAmount();
    return targetAmount == null
      ? items
      : [
          {
            series: 'target' as const,
            label: this.#labels.target,
          },
          ...items,
        ];
  });

  protected isSeriesHidden(series: GoalProjectionSeries): boolean {
    return this.#hiddenSeries().has(series);
  }

  protected seriesToggleLabel(item: GoalProjectionSummaryItem): string {
    return this.#transloco.translate(
      this.isSeriesHidden(item.series)
        ? 'savingsGoals.plan.chartShowSeries'
        : 'savingsGoals.plan.chartHideSeries',
      { series: item.label },
    );
  }

  protected toggleSeries(series: GoalProjectionSeries): void {
    const datasetIndex = this.chartData().datasets.findIndex(
      (dataset) => dataset.label === this.#labels[series],
    );
    if (datasetIndex < 0) return;

    const hidden = !this.isSeriesHidden(series);
    const next = new Set(this.#hiddenSeries());
    if (hidden) {
      next.add(series);
    } else {
      next.delete(series);
    }
    this.#hiddenSeries.set(next);
    this.chart()?.hideDataset(datasetIndex, hidden);
  }

  protected readonly ariaSentence = computed(() => {
    const months = this.months();
    if (months.length === 0) return '';
    if (this.#amountsVisibility.amountsHidden()) {
      return this.#transloco.translate('savingsGoals.plan.chartAriaHidden');
    }
    const draft = this.draft();
    const currency = this.currency();
    const projectedFinal = draft?.simulatedFinal ?? this.projected();

    const targetAmount = this.targetAmount();
    const key =
      targetAmount == null
        ? 'savingsGoals.plan.chartAriaWithoutTarget'
        : 'savingsGoals.plan.chartAria';
    return this.#transloco.translate(key, {
      confirmed: formatCurrency(this.confirmed(), currency),
      projected: formatCurrency(projectedFinal, currency),
      ...(targetAmount == null
        ? {}
        : { target: formatCurrency(targetAmount, currency) }),
    });
  });
}

type GoalProjectionSeries = 'target' | 'confirmed' | 'projection';
interface GoalProjectionSummaryItem {
  series: GoalProjectionSeries;
  label: string;
}
