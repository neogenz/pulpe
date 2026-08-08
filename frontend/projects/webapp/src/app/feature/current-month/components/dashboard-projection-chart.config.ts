import type { Chart, ChartConfiguration } from 'chart.js';
import type { SupportedCurrency } from 'pulpe-shared';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import {
  type ChartThemeColors,
  colorWithAlpha,
  formatShortMonth,
  formatCurrency,
  CHART_FONT_FAMILY,
  resolveChartAnimation,
} from '@core/chart/chart-theme';

const AXIS_ABBREVIATION_THRESHOLD = 1000;

export function buildProjectionChartOptions(
  theme: ChartThemeColors | null,
  amountsHidden = false,
  currency: SupportedCurrency = 'CHF',
): ChartConfiguration['options'] {
  const tickColor = theme?.tickColor || undefined;
  const gridColor = theme?.gridColor || undefined;
  const tooltipBg = theme?.tooltipBg || undefined;

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: resolveChartAnimation(),
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 3,
      },
      point: {
        radius: 4,
        hoverRadius: 6,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          font: { family: CHART_FONT_FAMILY },
          color: tickColor,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        padding: 12,
        titleFont: { size: 14, family: CHART_FONT_FAMILY },
        bodyFont: { size: 14, family: CHART_FONT_FAMILY, weight: 'bold' },
        displayColors: true,
        callbacks: {
          label: function (context: {
            dataset: { label?: string };
            parsed: { y: number | null };
          }) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += amountsHidden
                ? '•••••'
                : formatCurrency(context.parsed.y, currency);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: CHART_FONT_FAMILY,
            size: 11,
          },
          color: tickColor,
        },
      },
      y: {
        grid: {
          color: gridColor,
        },
        ticks: {
          font: {
            family: CHART_FONT_FAMILY,
            size: 11,
          },
          color: tickColor,
          callback: function (value: string | number) {
            if (amountsHidden) return '•';
            const num = Number(value);
            if (num >= AXIS_ABBREVIATION_THRESHOLD)
              return num / AXIS_ABBREVIATION_THRESHOLD + 'k';
            return num;
          },
        },
      },
    },
  };
}

export function buildProjectionChartData(
  forecasts: UpcomingMonthForecast[],
  theme: ChartThemeColors | null,
  locale: string,
  labels: { available: string; cumulatedSavings: string },
): ChartConfiguration['data'] {
  const withBudget = forecasts.filter((f) => f.hasBudget);

  if (withBudget.length === 0 || !theme) {
    return { datasets: [], labels: [] };
  }

  const balanceData = withBudget.map(
    (f) => (f.income || 0) - (f.expenses || 0),
  );

  let cumulativeSavings = 0;
  const savingsData: number[] = [];
  const hasSavings = withBudget.some((f) => (f.savings || 0) > 0);
  for (const f of withBudget) {
    cumulativeSavings += f.savings || 0;
    savingsData.push(cumulativeSavings);
  }

  // This line used to be `theme.income`, which is the hue the history chart
  // gives its income bars four hundred pixels below — and this series is not
  // income, it is income minus expenses. One page taught blue to mean "money
  // coming in" and then reused it for "money left", the lie DESIGN.md §2 names.
  //
  // The stroke goes neutral rather than green, because green is already the
  // cumulative-savings line in this same chart and two green series would trade
  // one collision for another. The hero solves the same problem the same way:
  // "Disponible" is the one quantity it draws without a hue, as a hollow
  // stroke. The sign still reads — the area fill below the line stays green
  // above zero and amber under it, which is where the meaning lives in an area
  // chart.
  const balanceFillColor = colorWithAlpha(theme.savings, 0.15);
  const negativeFillColor = colorWithAlpha(theme.negative, 0.15);

  const datasets: ChartConfiguration['data']['datasets'] = [
    {
      data: balanceData,
      label: labels.available,
      borderColor: theme.tickColor,
      fill: 'origin',
      backgroundColor: ((context: { chart: Chart }) => {
        const yScale = context.chart.scales['y'];
        const chartArea = context.chart.chartArea;
        if (!yScale || !chartArea || !chartArea.bottom) {
          return balanceFillColor;
        }
        const zeroY = yScale.getPixelForValue(0);
        const gradient = context.chart.ctx.createLinearGradient(
          0,
          chartArea.top,
          0,
          chartArea.bottom,
        );
        const ratio = Math.max(
          0,
          Math.min(
            1,
            (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top),
          ),
        );
        gradient.addColorStop(0, balanceFillColor);
        gradient.addColorStop(ratio, balanceFillColor);
        gradient.addColorStop(ratio, negativeFillColor);
        gradient.addColorStop(1, negativeFillColor);
        return gradient;
      }) as unknown as string,
      pointBackgroundColor: theme.tickColor,
      pointBorderColor: theme.tickColor,
    },
  ];

  if (hasSavings) {
    datasets.push({
      data: savingsData,
      label: labels.cumulatedSavings,
      borderColor: theme.savings,
      backgroundColor: colorWithAlpha(theme.savings, 0.1),
      fill: true,
      pointBackgroundColor: theme.savings,
      borderDash: [6, 4],
      borderWidth: 2,
    } as ChartConfiguration['data']['datasets'][number]);
  }

  return {
    labels: withBudget.map((f) => formatShortMonth(f.month, locale)),
    datasets,
  };
}
