import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

const CHF_FORMATTER = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
});

export const CHART_FONT_FAMILY = 'DM Sans, sans-serif';

export function resolveColor(cssValue: string): string {
  const el = document.createElement('div');
  el.style.color = cssValue;
  el.style.display = 'none';
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  return resolved;
}

export function resolveColors<K extends string>(
  vars: Record<K, string>,
): Record<K, string> {
  const container = document.createElement('div');
  container.style.display = 'none';
  const keys = Object.keys(vars) as K[];
  const elements = keys.map((key) => {
    const el = document.createElement('span');
    el.style.color = vars[key];
    container.appendChild(el);
    return el;
  });
  document.body.appendChild(container);
  const result = {} as Record<K, string>;
  keys.forEach((key, i) => {
    result[key] = getComputedStyle(elements[i]).color;
  });
  document.body.removeChild(container);
  return result;
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

export function formatShortMonth(monthNumber: number): string {
  const date = new Date(2000, monthNumber - 1, 1);
  const month = MONTH_FORMATTER.format(date);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function formatCHF(value: number): string {
  return CHF_FORMATTER.format(value);
}
