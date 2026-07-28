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
import { BaseChartDirective } from 'ng2-charts';
import type { Plugin } from 'chart.js';
import { TranslocoService } from '@jsverse/transloco';
import {
  type SavingsGoalPlanMonth,
  type SavingsPlanSimulationResult,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { AppCurrencyPipe } from '@core/currency';
import {
  type ChartThemeColors,
  formatCurrency,
  registerChartPlugins,
  resolveChartThemeColors,
} from '@core/chart/chart-theme';
import {
  buildGoalProjectionChartData,
  buildGoalProjectionChartOptions,
  MASKED_VALUE,
} from './goal-projection-chart.config';
import {
  buildGoalProjectionGuidePlugin,
  findCurrentPeriodIndex,
} from './goal-projection-chart.plugin';

/**
 * « Ta trajectoire » (docs/SAVINGS.md §10.1). Read-only cumulated
 * chart: confirmed savings in green, planned projection in tertiary blue, and a
 * neutral target. Switches its data source to the simulation sandbox when
 * `draft` is provided. The canvas is paired with an offscreen `aria-live`
 * sentence so screen readers get the trajectory without the visual.
 */
@Component({
  selector: 'pulpe-goal-projection-chart',
  imports: [AppCurrencyPipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-w-0 rounded-2xl bg-surface-container-low p-3 sm:p-4"
      data-testid="goal-projection-panel"
    >
      <div
        class="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-4"
      >
        <div class="relative h-[220px] min-w-0 w-full sm:h-[260px]">
          <canvas
            baseChart
            aria-hidden="true"
            [data]="chartData()"
            [options]="chartOptions()"
            [plugins]="chartPlugins()"
            [type]="chartType"
          ></canvas>
        </div>

        <dl
          class="min-w-0 border-t border-outline-variant/50 lg:border-t-0 lg:border-l"
          data-testid="goal-projection-summary"
        >
          @for (item of summaryItems(); track item.series) {
            <div
              class="flex min-w-0 items-center gap-3 border-t border-outline-variant/50 py-3 first:border-t-0 lg:px-4"
            >
              <dt
                class="flex min-w-0 items-center gap-2 text-body-medium text-on-surface-variant"
              >
                @switch (item.series) {
                  @case ('target') {
                    <span
                      class="h-px w-5 shrink-0 bg-on-surface-variant"
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
              </dt>
              <dd
                class="ph-no-capture ml-auto shrink-0 text-body-medium font-semibold tabular-nums"
                [class.amounts-visible]="amountsHidden()"
                [attr.data-testid]="'goal-projection-summary-' + item.series"
              >
                @if (amountsHidden()) {
                  {{ maskedValue }}
                } @else {
                  {{ item.amount | appCurrency: currency() : '1.0-0' }}
                }
              </dd>
            </div>
          }
        </dl>
      </div>

      <p class="sr-only" aria-live="polite" data-testid="goal-projection-aria">
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

  readonly chartType = 'line' as const;
  protected readonly amountsHidden = this.#amountsVisibility.amountsHidden;
  protected readonly maskedValue = MASKED_VALUE;

  readonly #labels = {
    target: this.#transloco.translate('savingsGoals.plan.chartTarget'),
    confirmed: this.#transloco.translate('savingsGoals.plan.chartConfirmed'),
    projection: this.#transloco.translate('savingsGoals.plan.chartProjection'),
  };
  readonly #summaryLabels = {
    target: this.#labels.target,
    confirmed: this.#labels.confirmed,
    projection: this.#transloco.translate('savingsGoals.detail.projected'),
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
        label: this.#summaryLabels.confirmed,
        amount: this.confirmed(),
      },
      {
        series: 'projection' as const,
        label: this.#summaryLabels.projection,
        amount: this.draft()?.simulatedFinal ?? this.projected(),
      },
    ];
    const targetAmount = this.targetAmount();
    return targetAmount == null
      ? items
      : [
          {
            series: 'target' as const,
            label: this.#summaryLabels.target,
            amount: targetAmount,
          },
          ...items,
        ];
  });

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
