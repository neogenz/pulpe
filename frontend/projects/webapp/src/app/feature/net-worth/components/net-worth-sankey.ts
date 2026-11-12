import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
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
import { toSignal } from '@angular/core/rxjs-interop';
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
import { map } from 'rxjs';
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
  category: 'left',
  gross: 'right',
  net: 'right',
  // Left of its bar: the space under the categories' flows is empty.
  shortfall: 'left',
  debt: 'right',
  overdrafts: 'right',
};
// Room for the labels that sit outside the plot: the Types on the left, the
// net and debts column on the right.
const LABEL_GUTTER = 150;
// On a phone the gutters give way, so the diagram fits its card instead of scrolling.
const HANDSET_LABEL_GUTTER = 96;
// The columns are then too close for a label between them: « Ce que j'ai »
// sits above its node, as on iOS.
const HANDSET_LABEL_SIDE: Record<SankeyNodeKind, SankeyLabelPosition> = {
  ...LABEL_SIDE,
  gross: 'top',
};
// Two lines of 12px text.
const LABEL_HEIGHT = 32;

/**
 * « Répartition aujourd'hui »: each Type flows into « Ce que j'ai », which
 * splits into the debt Types and Fortune nette.
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
        class="min-w-0 rounded-2xl bg-surface-container-low p-4 md:p-6"
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

        @if (theme()) {
          <div class="ph-no-capture relative h-[300px] w-full md:h-[380px]">
            <canvas
              baseChart
              aria-hidden="true"
              [type]="chartType"
              [data]="chartData()"
              [options]="chartOptions()"
            ></canvas>
          </div>
        }

        <p class="ph-no-capture sr-only" data-testid="net-worth-sankey-aria">
          {{ ariaSentence() }}
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

  readonly #isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  readonly #labelGutter = computed(() =>
    this.#isHandset() ? HANDSET_LABEL_GUTTER : LABEL_GUTTER,
  );
  readonly #labelSide = computed(() =>
    this.#isHandset() ? HANDSET_LABEL_SIDE : LABEL_SIDE,
  );

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
            primary: 'var(--pulpe-financial-savings)',
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
    const labelSide = this.#labelSide();
    const colorOf = (id: string): string => {
      const kind = nodes[id]?.kind;
      const isDebtSide =
        kind === 'debt' || kind === 'overdrafts' || kind === 'shortfall';
      return (isDebtSide ? colors?.amber : colors?.primary) ?? '';
    };
    // The fixed nodes carry no name: the chart labels them by kind.
    const fixedNames: Partial<Record<SankeyNodeKind, string>> = {
      gross: this.#transloco.translate('netWorth.gross'),
      net: this.#transloco.translate('netWorth.sankey.net'),
      shortfall: this.#transloco.translate('netWorth.sankey.shortfall'),
      overdrafts: this.#transloco.translate('netWorth.sankey.overdrafts'),
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
                labelSide[node.kind],
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
          // A label is two lines tall: thin nodes stay far enough apart for
          // their labels never to overlap.
          nodePadding: LABEL_HEIGHT,
        },
      ],
    };
  });

  protected readonly chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: resolveChartAnimation(),
    layout: {
      padding: {
        left: this.#labelGutter(),
        right: this.#labelGutter(),
        // The label of a thin first or last node overflows it by half; on a
        // phone a whole label sits above the middle node.
        top: this.#isHandset() ? LABEL_HEIGHT + 8 : LABEL_HEIGHT / 2,
        bottom: LABEL_HEIGHT / 2,
      },
    },
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
