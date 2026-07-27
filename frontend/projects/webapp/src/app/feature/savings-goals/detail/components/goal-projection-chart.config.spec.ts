import { describe, it, expect } from 'vitest';
import type {
  SavingsGoalPlanMonth,
  SavingsPlanSimulatedMonth,
  SavingsPlanSimulationResult,
} from 'pulpe-shared';
import type { ChartDataset } from 'chart.js';
import type { ChartThemeColors } from '@core/chart/chart-theme';
import {
  buildGoalProjectionChartData,
  buildGoalProjectionChartOptions,
} from './goal-projection-chart.config';
import { findCurrentPeriodIndex } from './goal-projection-chart.plugin';

const theme: ChartThemeColors = {
  income: 'rgb(76, 175, 80)',
  expense: 'rgb(244, 67, 54)',
  savings: 'rgb(33, 150, 243)',
  negative: 'rgb(255, 87, 34)',
  tickColor: 'rgb(102, 102, 102)',
  gridColor: 'rgba(102, 102, 102, 0.08)',
  tooltipBg: 'rgba(0, 0, 0, 0.9)',
};

const labels = {
  target: 'Cible',
  confirmed: 'Épargné',
  projection: 'Projection planifiée',
};

function makeMonth(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 1,
    year: 2026,
    state: 'past',
    isLocked: true,
    plannedAmount: 100,
    confirmedAmount: 100,
    plannedCumulative: 100,
    confirmedCumulative: 100,
    lines: [],
    ...overrides,
  };
}

const months: SavingsGoalPlanMonth[] = [
  makeMonth({
    month: 1,
    state: 'past',
    plannedCumulative: 100,
    confirmedCumulative: 100,
  }),
  makeMonth({
    month: 2,
    state: 'current',
    isLocked: false,
    confirmedAmount: 20,
    plannedCumulative: 200,
    confirmedCumulative: 180,
  }),
  makeMonth({
    month: 3,
    state: 'future',
    isLocked: false,
    confirmedAmount: 0,
    plannedCumulative: 300,
    confirmedCumulative: 180,
  }),
];

describe('buildGoalProjectionChartData', () => {
  it('returns empty datasets when there are no months', () => {
    const data = buildGoalProjectionChartData({
      months: [],
      draft: null,
      targetAmount: 300,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });
    expect(data.datasets).toHaveLength(0);
  });

  it('builds cible, épargné et projection planifiée in read mode', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });
    expect(data.datasets.map((d) => d.label)).toEqual([
      'Cible',
      'Épargné',
      'Projection planifiée',
    ]);
    const [target, confirmed, projection] = data.datasets as ChartDataset<
      'line',
      (number | null)[]
    >[];
    expect(target.borderDash).toBeUndefined();
    expect(confirmed.pointRadius).toEqual([0, 3, 0]);
    expect(confirmed.borderColor).toBe(theme.savings);
    expect(projection.borderDash).toEqual([4, 4]);
    expect(projection.borderColor).toBe(theme.income);
    expect(projection.pointRadius).toEqual([0, 0, 3]);
  });

  it('keeps the savings series and omits only the target without a target amount', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: null,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });

    expect(data.datasets.map((dataset) => dataset.label)).toEqual([
      'Épargné',
      'Projection planifiée',
    ]);
  });

  it('nulls the pointé series after the current month', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });
    const confirmed = data.datasets.find((d) => d.label === 'Épargné');
    // Index 2 is the future month → reality must stop (null), not extend.
    expect(confirmed?.data).toEqual([100, 180, null]);
  });

  it('anchors the planned projection on confirmed and ends on projected', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });
    const projection = data.datasets.find(
      (d) => d.label === 'Projection planifiée',
    );
    expect(projection?.data).toEqual([null, 180, 360]);
  });

  it('follows the sandbox as the planned projection in simulation mode', () => {
    const draft: SavingsPlanSimulationResult = {
      months: months.map(
        (month, index): SavingsPlanSimulatedMonth => ({
          ...month,
          simulatedAmount: [100, 100, 160][index],
          simulatedCumulative: [160, 260, 420][index],
          isAdjusted: index === 2,
        }),
      ),
      simulatedFinal: 420,
      gapToTarget: -120,
      isTargetMet: true,
      attainedPeriod: { month: 3, year: 2026 },
    };
    const data = buildGoalProjectionChartData({
      months,
      draft,
      targetAmount: 300,
      confirmed: 180,
      projected: 360,
      theme,
      locale: 'fr-CH',
      labels,
    });
    const projection = data.datasets.find(
      (d) => d.label === 'Projection planifiée',
    );
    expect(projection?.data).toEqual([null, 180, 420]);
  });
});

describe('buildGoalProjectionChartOptions', () => {
  it('keeps the timeline sparse and hides the vertical accounting axis', () => {
    const options = buildGoalProjectionChartOptions(theme);

    expect(options?.scales?.['x']?.grid?.display).toBe(false);
    expect(options?.scales?.['y']?.display).toBe(false);
    expect(options?.elements?.line?.cubicInterpolationMode).toBe('monotone');
    expect(options?.plugins?.legend?.display).toBe(false);
  });
});

describe('findCurrentPeriodIndex', () => {
  it('returns only a real current period', () => {
    expect(findCurrentPeriodIndex(months)).toBe(1);
    expect(
      findCurrentPeriodIndex(
        months.map((month) => ({ ...month, state: 'past' })),
      ),
    ).toBe(-1);
  });
});
