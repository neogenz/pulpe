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
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import {
  CHART_FONT_FAMILY,
  colorWithAlpha,
  formatCurrency,
  formatShortMonth,
  registerChartPlugins,
  resolveChartThemeColors,
  type ChartThemeColors,
} from '@core/chart/chart-theme';
import type { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { SupportedCurrency, TagHistoryMonth } from 'pulpe-shared';

const MASKED_VALUE = '•••••';

interface TagHistoryChartLabels {
  planned: string;
  actual: string;
}

export function buildTagHistoryChartData(
  periods: readonly TagHistoryMonth[],
  theme: ChartThemeColors | null,
  locale: string,
  labels: TagHistoryChartLabels,
): ChartConfiguration['data'] {
  return {
    labels: periods.map(
      (period) =>
        `${formatShortMonth(period.month, locale)} ${String(period.year).slice(-2)}`,
    ),
    datasets: [
      {
        data: periods.map((period) => period.plannedAmount),
        label: labels.planned,
        backgroundColor: colorWithAlpha(theme?.tickColor ?? '', 0.35),
        borderRadius: 4,
        barPercentage: 0.65,
        categoryPercentage: 0.8,
      },
      {
        data: periods.map((period) => period.actualAmount),
        label: labels.actual,
        backgroundColor: theme?.expense ?? '',
        borderRadius: 4,
        barPercentage: 0.65,
        categoryPercentage: 0.8,
      },
    ],
  };
}

export function buildTagHistoryChartOptions(
  theme: ChartThemeColors | null,
  amountsHidden: boolean,
  currency: SupportedCurrency,
  reducedMotion: boolean,
): ChartConfiguration['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          color: theme?.tickColor,
          font: { family: CHART_FONT_FAMILY },
        },
      },
      tooltip: {
        backgroundColor: theme?.tooltipBg,
        titleFont: { family: CHART_FONT_FAMILY },
        bodyFont: { family: CHART_FONT_FAMILY },
        callbacks: {
          label: (context) => {
            const prefix = context.dataset.label
              ? `${context.dataset.label}: `
              : '';
            if (context.parsed.y === null) return prefix;
            return `${prefix}${
              amountsHidden
                ? MASKED_VALUE
                : formatCurrency(context.parsed.y, currency)
            }`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: theme?.tickColor,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: { color: theme?.gridColor },
        border: { display: false, dash: [4, 4] },
        ticks: {
          color: theme?.tickColor,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (value) => {
            if (amountsHidden) return '•';
            const amount = Number(value);
            return amount >= 1000 ? `${amount / 1000}k` : amount;
          },
        },
      },
    },
  };
}

@Component({
  selector: 'pulpe-tag-history-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-w-0 flex-col gap-2">
      <div class="relative h-[260px] min-w-0 w-full">
        <canvas
          baseChart
          aria-hidden="true"
          [data]="chartData()"
          [options]="chartOptions()"
          [type]="chartType"
        ></canvas>
      </div>
      <p class="sr-only" aria-live="polite" data-testid="tag-history-aria">
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
export class TagHistoryChart {
  readonly #doc = inject(DOCUMENT);
  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);
  readonly #amountsVisibility = inject(AmountsVisibilityService);

  readonly periods = input.required<readonly TagHistoryMonth[]>();
  readonly selectedTagName = input.required<string>();
  readonly currency = input.required<SupportedCurrency>();
  readonly totalActual = input.required<number>();
  readonly monthlyAverageActual = input.required<number>();

  readonly #theme = signal<ChartThemeColors | null>(null);
  readonly #reducedMotion = signal(false);
  readonly chartType: ChartType = 'bar';
  readonly #labels: TagHistoryChartLabels = {
    planned: this.#transloco.translate('tagHistory.plannedSeries'),
    actual: this.#transloco.translate('tagHistory.actualSeries'),
  };

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

  readonly chartData = computed(() =>
    buildTagHistoryChartData(
      this.periods(),
      this.#theme(),
      this.#locale,
      this.#labels,
    ),
  );

  readonly chartOptions = computed(() =>
    buildTagHistoryChartOptions(
      this.#theme(),
      this.#amountsVisibility.amountsHidden(),
      this.currency(),
      this.#reducedMotion(),
    ),
  );

  readonly ariaSentence = computed(() => {
    const months = this.periods().length;
    if (months === 0) return '';
    if (this.#amountsVisibility.amountsHidden()) {
      return this.#transloco.translate('tagHistory.chartAriaHidden', {
        tag: this.selectedTagName(),
        months,
      });
    }
    return this.#transloco.translate('tagHistory.chartAria', {
      tag: this.selectedTagName(),
      months,
      total: formatCurrency(this.totalActual(), this.currency()),
      average: formatCurrency(this.monthlyAverageActual(), this.currency()),
    });
  });
}
