import type { ChartConfiguration } from 'chart.js';
import type {
  SavingsGoalPlanMonth,
  SavingsPlanSimulationResult,
  SupportedCurrency,
} from 'pulpe-shared';
import {
  type ChartThemeColors,
  colorWithAlpha,
  formatShortMonth,
  formatCurrency,
  CHART_FONT_FAMILY,
} from '@core/chart/chart-theme';

const AXIS_ABBREVIATION_THRESHOLD = 1000;
const MASKED_VALUE = '•••••';

export interface GoalProjectionChartLabels {
  target: string;
  confirmed: string;
  projection: string;
}

export interface GoalProjectionChartInput {
  months: readonly SavingsGoalPlanMonth[];
  /** Non-null in simulation mode: the plan line follows the sandbox trajectory. */
  draft: SavingsPlanSimulationResult | null;
  targetAmount: number;
  confirmed: number;
  projected: number;
  theme: ChartThemeColors | null;
  locale: string;
  labels: GoalProjectionChartLabels;
}

export function buildGoalProjectionChartOptions(
  theme: ChartThemeColors | null,
  amountsHidden = false,
  currency: SupportedCurrency = 'CHF',
  reducedMotion = false,
): ChartConfiguration['options'] {
  const tickColor = theme?.tickColor || undefined;
  const gridColor = theme?.gridColor || undefined;
  const tooltipBg = theme?.tooltipBg || undefined;

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    elements: {
      line: { tension: 0.2, borderWidth: 2 },
      point: { radius: 0, hoverRadius: 4 },
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
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += amountsHidden
                ? MASKED_VALUE
                : formatCurrency(context.parsed.y, currency);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: CHART_FONT_FAMILY, size: 11 },
          color: tickColor,
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          font: { family: CHART_FONT_FAMILY, size: 11 },
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

function currentMonthIndex(months: readonly SavingsGoalPlanMonth[]): number {
  const index = months.findIndex((month) => month.state === 'current');
  if (index >= 0) return index;
  // No live current row (goal fully in the past): last locked row anchors the
  // confirmed/projection split.
  let lastLocked = -1;
  months.forEach((month, i) => {
    if (month.isLocked) lastLocked = i;
  });
  return lastLocked;
}

function buildPlannedProjection(
  months: readonly SavingsGoalPlanMonth[],
  currentIndex: number,
  confirmed: number,
  projected: number,
  monthlyAmounts = months.map((month) => month.plannedAmount),
): (number | null)[] {
  const data: (number | null)[] = months.map(() => null);
  if (currentIndex < 0) return data;

  const lastIndex = months.length - 1;
  if (currentIndex === lastIndex) {
    data[currentIndex] = projected;
    return data;
  }

  data[currentIndex] = confirmed;
  let cumulative = confirmed;
  for (let index = currentIndex; index <= lastIndex; index++) {
    const month = months[index];
    cumulative += Math.max(0, monthlyAmounts[index] - month.confirmedAmount);
    if (index > currentIndex) data[index] = cumulative;
  }
  // The server owns the canonical endpoint; this also absorbs float rounding.
  data[lastIndex] = projected;
  return data;
}

/**
 * Three balance series over the anchor → target axis (RG-002 — savings never
 * amber/red): cible, réalité épargnée through the current month, and planned
 * projection anchored on that reality. Simulation replaces the projection with
 * the sandbox trajectory.
 */
export function buildGoalProjectionChartData(
  input: GoalProjectionChartInput,
): ChartConfiguration['data'] {
  const {
    months,
    draft,
    targetAmount,
    confirmed,
    projected,
    theme,
    locale,
    labels,
  } = input;

  if (months.length === 0 || !theme) {
    return { datasets: [], labels: [] };
  }

  const currentIndex = currentMonthIndex(months);
  const targetData = months.map(() => targetAmount);
  const projectionData = draft
    ? buildPlannedProjection(
        months,
        currentIndex,
        confirmed,
        draft.simulatedFinal,
        draft.months.map((month) => month.simulatedAmount),
      )
    : buildPlannedProjection(months, currentIndex, confirmed, projected);

  // Reality stops at the current month — a null tail keeps the line from
  // implying pointé data exists in the future.
  const confirmedData = months.map((month, index) =>
    index < currentIndex
      ? month.confirmedCumulative
      : index === currentIndex
        ? confirmed
        : null,
  );

  const datasets: ChartConfiguration['data']['datasets'] = [
    {
      data: targetData,
      label: labels.target,
      borderColor: colorWithAlpha(theme.tickColor, 0.5),
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
    } as ChartConfiguration['data']['datasets'][number],
    {
      data: confirmedData,
      label: labels.confirmed,
      borderColor: theme.savings,
      backgroundColor: colorWithAlpha(theme.savings, 0.12),
      pointBackgroundColor: theme.savings,
      spanGaps: false,
      fill: 'origin',
    } as ChartConfiguration['data']['datasets'][number],
    {
      data: projectionData,
      label: labels.projection,
      borderColor: theme.savings,
      borderDash: [6, 4],
      backgroundColor: 'transparent',
      pointBackgroundColor: theme.savings,
      fill: false,
    } as ChartConfiguration['data']['datasets'][number],
  ];

  return {
    // Two-line `[mois, année]` at each January and on the first point so a
    // multi-year trajectory (or one straddling a year boundary) stays readable;
    // plain month elsewhere to avoid repeating the year on every tick.
    labels: months.map((month, index) =>
      index === 0 || month.month === 1
        ? [formatShortMonth(month.month, locale), String(month.year)]
        : formatShortMonth(month.month, locale),
    ),
    datasets,
  };
}
