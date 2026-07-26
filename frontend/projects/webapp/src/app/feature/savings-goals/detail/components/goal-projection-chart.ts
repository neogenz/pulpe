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
import type { ChartType } from 'chart.js';
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

/**
 * « Ta trajectoire » (docs/SAVINGS.md §10.1). Read-only cumulated
 * chart (savings green only, RG-002 — never amber/red). Switches its data source
 * to the simulation sandbox when `draft` is provided. The canvas is paired with
 * an offscreen `aria-live` sentence so screen readers get the trajectory without
 * the visual.
 */
@Component({
  selector: 'pulpe-goal-projection-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <div class="relative h-[260px] w-full">
        <canvas
          baseChart
          aria-hidden="true"
          [data]="chartData()"
          [options]="chartOptions()"
          [type]="chartType"
        ></canvas>
      </div>
      <p class="sr-only" aria-live="polite" data-testid="goal-projection-aria">
        {{ ariaSentence() }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
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
  readonly targetAmount = input.required<number>();
  readonly currency = input.required<SupportedCurrency>();
  readonly confirmed = input.required<number>();
  readonly projected = input.required<number>();

  readonly #theme = signal<ChartThemeColors | null>(null);
  readonly #reducedMotion = signal(false);

  readonly chartType: ChartType = 'line';

  readonly #labels = {
    target: this.#transloco.translate('savingsGoals.plan.chartTarget'),
    confirmed: this.#transloco.translate('savingsGoals.plan.chartConfirmed'),
    projection: this.#transloco.translate('savingsGoals.plan.chartProjection'),
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

  protected readonly ariaSentence = computed(() => {
    const months = this.months();
    if (months.length === 0) return '';
    const draft = this.draft();
    const currency = this.currency();
    const projectedFinal = draft?.simulatedFinal ?? this.projected();

    return this.#transloco.translate('savingsGoals.plan.chartAria', {
      confirmed: formatCurrency(this.confirmed(), currency),
      projected: formatCurrency(projectedFinal, currency),
      target: formatCurrency(this.targetAmount(), currency),
    });
  });
}
