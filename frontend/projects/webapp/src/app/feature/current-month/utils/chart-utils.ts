import { Chart, registerables } from 'chart.js';
import type { SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG } from '@core/currency';

let _registered = false;

export function registerChartPlugins(): void {
  if (_registered) return;
  Chart.register(...registerables);
  _registered = true;
}

export const CHART_FONT_FAMILY = 'DM Sans, sans-serif';

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

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(
  locale: string,
  currency: SupportedCurrency,
): Intl.NumberFormat {
  const key = `${locale}-${currency}`;
  let formatter = CURRENCY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  const config = CURRENCY_CONFIG[currency];
  return getCurrencyFormatter(config.locale, currency).format(value);
}
