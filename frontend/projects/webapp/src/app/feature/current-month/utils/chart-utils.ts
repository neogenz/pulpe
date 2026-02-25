import { Chart, registerables } from 'chart.js';

let _registered = false;

export function registerChartPlugins(): void {
  if (_registered) return;
  Chart.register(...registerables);
  _registered = true;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

const CHF_FORMATTER = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
});

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
    const result = {} as Record<K, string>;
    keys.forEach((key, i) => {
      result[key] = getComputedStyle(elements[i]).color;
    });
    return result;
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

export function formatShortMonth(monthNumber: number): string {
  const date = new Date(2000, monthNumber - 1, 1);
  const month = MONTH_FORMATTER.format(date);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function formatCHF(value: number): string {
  return CHF_FORMATTER.format(value);
}
