import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Chart, LinearScale, type ChartData } from 'chart.js';
import {
  Flow,
  SankeyController,
  type SankeyDataPoint,
  type SankeyLabelPosition,
  type SankeyScriptableContext,
} from 'chartjs-chart-sankey';
import { BaseChartDirective } from 'ng2-charts';
import type { NetWorth } from 'pulpe-shared';
import {
  CHART_FONT_FAMILY,
  formatCurrencyForAria,
  resolveChartAnimation,
  resolveColors,
} from '@core/chart/chart-theme';
import { AppCurrencyPipe } from '@core/currency';
import { ThemeService } from '@core/theme';
import {
  buildNetWorthSankey,
  type SankeyNodeKind,
} from './net-worth-sankey.flows';

// Registered here, not in `chart-theme`: the Sankey plugin only ships with this
// lazy feature chunk. Module-load registration for the same reason as there:
// ng2-charts builds the chart before any component hook could run.
Chart.register(SankeyController, Flow, LinearScale);

// Node labels round to the franc, like the canvas: the hero carries the cents.
const wholeAmount = new AppCurrencyPipe();

const LABEL_SIDE: Record<SankeyNodeKind, SankeyLabelPosition> = {
  asset: 'left',
  category: 'right',
  gross: 'right',
  net: 'right',
  // Left of its bar: the space under the categories' flows is empty.
  shortfall: 'left',
  debt: 'right',
};
// Room for the labels that sit outside the plot: assets on the left, the
// net and debts column on the right.
const LABEL_GUTTER = 150;

/**
 * « Répartition aujourd'hui »: each asset flows into its category, the
 * categories into Fortune brute, which splits into debts and Fortune nette.
 * Widths come from the figures the API computed (see `net-worth-sankey.flows`);
 * nothing is summed here.
 */
@Component({
  selector: 'pulpe-net-worth-sankey',
  imports: [BaseChartDirective, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasFlows()) {
      <section
        class="min-w-0 rounded-2xl border border-outline-variant p-4 md:p-6"
        aria-labelledby="net-worth-sankey-title"
        data-testid="net-worth-sankey"
      >
        <div
          class="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
        >
          <h2
            id="net-worth-sankey-title"
            class="text-title-large font-semibold"
          >
            {{ 'netWorth.sankey.title' | transloco }}
          </h2>
          <p class="text-body-medium text-on-surface-variant">
            {{
              (isNetPositive()
                ? 'netWorth.sankey.subtitle'
                : 'netWorth.sankey.subtitleDebts'
              ) | transloco
            }}
          </p>
        </div>

        <div class="overflow-x-auto">
          @if (theme()) {
            <div class="ph-no-capture relative h-[380px] min-w-[760px] w-full">
              <canvas
                baseChart
                aria-hidden="true"
                [type]="chartType"
                [data]="chartData()"
                [options]="chartOptions()"
              ></canvas>
            </div>
          }
        </div>

        <p class="ph-no-capture sr-only" data-testid="net-worth-sankey-aria">
          {{ ariaSentence() }}
        </p>
        <p class="mt-2 text-body-small text-on-surface-variant md:hidden">
          {{ 'netWorth.sankey.mobileHint' | transloco }}
        </p>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class NetWorthSankey {
  readonly #doc = inject(DOCUMENT);
  readonly #transloco = inject(TranslocoService);
  readonly #themeService = inject(ThemeService);

  readonly netWorth = input.required<NetWorth>();

  protected readonly chartType = 'sankey' as const;
  protected readonly theme = signal<{
    primary: string;
    amber: string;
    text: string;
  } | null>(null);

  readonly #sankey = computed(() => buildNetWorthSankey(this.netWorth()));
  protected readonly hasFlows = computed(() => this.#sankey().flows.length > 0);
  protected readonly isNetPositive = computed(
    () => this.netWorth().totals.net > 0,
  );

  constructor() {
    // The canvas cannot read CSS variables: resolve them again whenever the
    // theme flips, after the render that applied the new theme class.
    afterRenderEffect(() => {
      this.#themeService.isDark();
      this.theme.set(
        resolveColors(
          {
            primary: 'var(--mat-sys-primary)',
            amber: 'var(--pulpe-amber)',
            text: 'var(--mat-sys-on-surface)',
          },
          this.#doc,
        ),
      );
    });
  }

  protected readonly chartData = computed<
    ChartData<'sankey', SankeyDataPoint[]>
  >(() => {
    const { flows, nodes, columns, priorities } = this.#sankey();
    const { baseCurrency } = this.netWorth().totals;
    const colors = this.theme();
    const colorOf = (id: string): string => {
      const kind = nodes[id]?.kind;
      const isDebtSide = kind === 'debt' || kind === 'shortfall';
      return (isDebtSide ? colors?.amber : colors?.primary) ?? '';
    };
    // The fixed nodes carry no name: the chart labels them by kind.
    const fixedNames: Partial<Record<SankeyNodeKind, string>> = {
      gross: this.#transloco.translate('netWorth.sankey.gross'),
      net: this.#transloco.translate('netWorth.sankey.net'),
      shortfall: this.#transloco.translate('netWorth.sankey.shortfall'),
    };

    return {
      datasets: [
        {
          label: this.#transloco.translate('netWorth.sankey.title'),
          data: flows,
          parsing: { from: 'from', to: 'to', flow: 'flow' },
          column: columns,
          ...(Object.keys(priorities).length > 0 && { priority: priorities }),
          labels: Object.fromEntries(
            Object.entries(nodes).map(([id, node]) => [
              id,
              `${node.name ?? fixedNames[node.kind]}\n${wholeAmount.transform(node.value, baseCurrency, '1.0-0')}`,
            ]),
          ),
          nodeLabels: {
            position: Object.fromEntries(
              Object.entries(nodes).map(([id, node]) => [
                id,
                LABEL_SIDE[node.kind],
              ]),
            ),
          },
          colorMode: 'gradient',
          colorFrom: (ctx: SankeyScriptableContext) => colorOf(ctx.raw.from),
          colorTo: (ctx: SankeyScriptableContext) => colorOf(ctx.raw.to),
          alpha: 0.3,
          color: colors?.text,
          font: { family: CHART_FONT_FAMILY, size: 12, weight: 600 },
          nodeWidth: 12,
          nodePadding: 14,
        },
      ],
    };
  });

  protected readonly chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: resolveChartAnimation(),
    layout: { padding: { left: LABEL_GUTTER, right: LABEL_GUTTER } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  }));

  protected readonly ariaSentence = computed(() => {
    const { gross, debts, net, baseCurrency } = this.netWorth().totals;
    const params = {
      gross: formatCurrencyForAria(gross, baseCurrency),
      debts: formatCurrencyForAria(debts, baseCurrency),
      net: formatCurrencyForAria(net, baseCurrency),
    };
    return this.#transloco.translate(
      net > 0 ? 'netWorth.sankey.ariaNet' : 'netWorth.sankey.ariaDebts',
      params,
    );
  });
}
