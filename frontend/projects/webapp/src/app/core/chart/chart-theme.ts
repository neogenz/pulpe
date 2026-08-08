import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
} from 'chart.js';
import { getCurrencyFormatter, type SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG } from '@core/currency';

// Register Chart.js at module load — BEFORE ng2-charts creates any Chart
// instance. Doing this lazily from a component's afterNextRender can lose the
// race (the directive builds the chart first) and leave scales unregistered
// ("category" is not a registered scale). Any chart component imports this
// module, so this side-effect runs before its chart renders.
//
// Explicit set instead of `...registerables` (which pulls every controller,
// scale and plugin — pie, radar, radial, time…) to keep the lazy chart chunk
// lean. Only what our line + bar charts actually use is registered:
//   controllers  Line / Bar  (history chart mixes a line dataset into bars)
//   elements     Line / Point / Bar
//   scales       Category (x) / Linear (y)
//   plugins      Filler (fill:'origin'/true area fills — LOAD-BEARING),
//                Legend, Tooltip
// Adding a new chart type/scale/plugin? Register it here or it silently no-ops.
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
);

export function registerChartPlugins(): void {
  // No-op: registration now happens at module load (above). Kept so existing
  // call sites compile unchanged.
}

export const CHART_FONT_FAMILY = 'DM Sans, sans-serif';

// Chart.js runs a 1000ms draw by default, and the two dashboard charts were the
// only motion in the app that ignored the system preference — everything else
// goes through `motion-safe:` or its own reduce block. Asked per build rather
// than resolved once at module load: the charts sit behind `@defer (on
// viewport)`, so the preference can change before the first one is ever
// created. `undefined` leaves Chart.js on its own default, and the optional
// call guards jsdom, which ships no `matchMedia`.
export function resolveChartAnimation(): false | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? false
    : undefined;
}

export function resolveColor(cssValue: string, doc: Document): string {
  const el = doc.createElement('div');
  el.style.color = cssValue;
  el.style.display = 'none';
  doc.body.appendChild(el);
  try {
    return getComputedStyle(el).color;
  } finally {
    doc.body.removeChild(el);
  }
}

export function resolveColors<K extends string>(
  vars: Record<K, string>,
  doc: Document,
): Record<K, string> {
  const container = doc.createElement('div');
  container.style.display = 'none';
  doc.body.appendChild(container);
  try {
    const keys = Object.keys(vars) as K[];
    const elements = keys.map((key) => {
      const el = doc.createElement('span');
      el.style.color = vars[key];
      container.appendChild(el);
      return el;
    });
    return Object.fromEntries(
      keys.map((key, i) => [key, getComputedStyle(elements[i]).color]),
    ) as Record<K, string>;
  } finally {
    doc.body.removeChild(container);
  }
}

export function colorWithAlpha(resolvedColor: string, alpha: number): string {
  const match = resolvedColor.match(
    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/,
  );
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  return resolvedColor;
}

export interface ChartThemeColors {
  income: string;
  expense: string;
  savings: string;
  negative: string;
  tickColor: string;
  gridColor: string;
  tooltipBg: string;
}

export function resolveChartThemeColors(doc: Document): ChartThemeColors {
  const resolved = resolveColors(
    {
      income: 'var(--pulpe-financial-income)',
      expense: 'var(--pulpe-financial-expense)',
      savings: 'var(--pulpe-financial-savings)',
      negative: 'var(--pulpe-financial-negative)',
      onSurfaceVariant: 'var(--mat-sys-on-surface-variant)',
      inverseSurface: 'var(--mat-sys-inverse-surface)',
    },
    doc,
  );
  return {
    income: resolved.income,
    expense: resolved.expense,
    savings: resolved.savings,
    negative: resolved.negative,
    tickColor: resolved.onSurfaceVariant,
    gridColor: colorWithAlpha(resolved.onSurfaceVariant, 0.08),
    tooltipBg: colorWithAlpha(resolved.inverseSurface, 0.9),
  };
}

const monthFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatShortMonth(monthNumber: number, locale: string): string {
  let formatter = monthFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
    monthFormatterCache.set(locale, formatter);
  }
  const date = new Date(2000, monthNumber - 1, 1);
  const month = formatter.format(date);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function formatCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  const config = CURRENCY_CONFIG[currency];
  return getCurrencyFormatter(currency, config.numberLocale).format(value);
}
